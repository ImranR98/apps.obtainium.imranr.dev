"""
generate_from_url.py

This script is used to generate an app config file from an Obtainium redirect URL.
"""

from urllib.parse import unquote
import json
import os

from colorama import Fore, init

init(autoreset=True)

APP_URL_PREFIX = "obtainium://app/"
APPS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "data", "apps"))
COMPLEX_KEYS = ("preferredApkIndex", "overrideSource", "altLabel")

def is_obtainium_url(url):
    """Check if the URL is valid."""
    return APP_URL_PREFIX in url

def extract_json_from_obtainium_url(url):
    """Extract JSON from the URL."""
    raw_json = url.split(APP_URL_PREFIX, 1)[1]
    try:
        return json.loads(raw_json)
    except json.JSONDecodeError:
        print(Fore.RED + "Invalid JSON. Please check the URL and try again.")
        return None

def has_complex_settings(app_config):
    """Check whether a config needs to go in the complex folder."""
    settings = app_config.get("additionalSettings")
    if settings:
        try:
            if len(json.loads(settings)) > 0:
                return True
        except json.JSONDecodeError:
            return True
    return any(app_config.get(key) is not None for key in COMPLEX_KEYS)

def build_app_json(app_config):
    """Build the config file contents and the subfolder it belongs in."""
    if has_complex_settings(app_config):
        config = {
            "id": app_config["id"],
            "url": app_config["url"],
            "author": app_config["author"],
            "name": app_config["name"]
        }
        for key in ("preferredApkIndex", "additionalSettings", "overrideSource", "altLabel"):
            if app_config.get(key) is not None:
                config[key] = app_config[key]
        return {
            "configs": [config],
            "icon": None,
            "categories": ["other"],
            "description": {"en": None}
        }, "complex"
    return {
        "config": {
            "id": app_config["id"],
            "url": app_config["url"],
            "author": app_config["author"],
            "name": app_config["name"]
        },
        "icon": None,
        "categories": ["other"],
        "description": {"en": None}
    }, "simple"

def find_existing_config_files(app_id):
    """Find existing config files for an app id in either folder."""
    return [
        os.path.join(APPS_PATH, folder, f"{app_id}.json")
        for folder in ("complex", "simple")
        if os.path.exists(os.path.join(APPS_PATH, folder, f"{app_id}.json"))
    ]

def find_config_file(name):
    """Locate a config file by file name or path relative to the apps folder."""
    if "/" in name or os.path.sep in name:
        candidate = os.path.join(APPS_PATH, name)
        return candidate if os.path.exists(candidate) else None
    for folder in ("complex", "simple"):
        candidate = os.path.join(APPS_PATH, folder, name)
        if os.path.exists(candidate):
            return candidate
    return None

def create_new_config():
    """Create a new app config file."""
    url_input = input("Input URL to extract JSON from: ")
    decoded_url = unquote(url_input)

    if not is_obtainium_url(decoded_url):
        print(Fore.RED + "Invalid URL. Please try again.")
        return

    app_config_json = extract_json_from_obtainium_url(decoded_url)

    if app_config_json is None:
        return

    app_id = app_config_json["id"]
    existing_files = find_existing_config_files(app_id)

    if existing_files:
        print(Fore.YELLOW + "A config for this app already exists:")
        for file in existing_files:
            print(Fore.YELLOW + file)
        print(Fore.RED + "Operation cancelled. Please use option 2 to add a config to the existing file instead.")
        return

    new_app_json, folder = build_app_json(app_config_json)
    app_file_path = os.path.join(APPS_PATH, folder, f"{app_id}.json")

    os.makedirs(os.path.dirname(app_file_path), exist_ok=True)

    with open(app_file_path, "w", encoding="utf-8") as app_file:
        json.dump(new_app_json, app_file, indent=4, ensure_ascii=False)
        app_file.write('\n')

    print(Fore.GREEN + f"File created at {app_file_path}")
    print(Fore.BLUE + "Ensure that you edit the created JSON file to add categories, descriptions and an icon.")

def update_existing_config():
    """Add an additional config to an existing config file."""
    url_input = unquote(input("Input URL to extract JSON from: "))

    if not is_obtainium_url(url_input):
        print(Fore.RED + "Invalid URL. Please try again.")
        return

    app_file_name_input = input("Input file to add config to (e.g. com.example.app.json): ")
    if not app_file_name_input.endswith('.json'):
        app_file_name_input += '.json'
    app_file_path = find_config_file(app_file_name_input)

    if app_file_path is None:
        print(Fore.RED + f"File {app_file_name_input} does not exist in simple/ or complex/. Please try creating a new config instead.")
        return

    app_config_json = extract_json_from_obtainium_url(url_input)

    if app_config_json is None:
        return

    with open(app_file_path, "r", encoding="utf-8") as app_file:
        existing_app_data = json.load(app_file)

    converted = "configs" not in existing_app_data
    if converted:
        existing_app_data["configs"] = [existing_app_data.pop("config")]

    existing_app_data["configs"].append(app_config_json)

    for config in existing_app_data["configs"]:
        if 'altLabel' not in config:
            config['altLabel'] = None

    if converted:
        existing_app_data = {
            "configs": existing_app_data["configs"],
            "icon": existing_app_data.get("icon"),
            "categories": existing_app_data.get("categories", ["other"]),
            "description": existing_app_data.get("description", {"en": None})
        }
        new_app_file_path = os.path.join(APPS_PATH, "complex", os.path.basename(app_file_path))
        os.makedirs(os.path.dirname(new_app_file_path), exist_ok=True)
        os.remove(app_file_path)
        app_file_path = new_app_file_path
        print(Fore.BLUE + "Config now has multiple configs, moved to the complex folder.")

    with open(app_file_path, "w", encoding="utf-8") as app_file:
        json.dump(existing_app_data, app_file, indent=4, ensure_ascii=False)
        app_file.write('\n')

    print(Fore.GREEN + f"Config added to {app_file_path}")
    print(Fore.BLUE + "Ensure that you edit the modified JSON file to add altLabels.")

def main():
    """Main function."""
    print("1. Create new app config")
    print("2. Add config to already existing app config file")
    user_choice = input("Enter your choice: ")

    actions = {"1": create_new_config, "2": update_existing_config}

    if user_choice in actions:
        actions[user_choice]()
    else:
        print(Fore.RED + "Invalid choice")

if __name__ == "__main__":
    main()
