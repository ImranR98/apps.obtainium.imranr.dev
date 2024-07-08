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
APP_DATA_PATH = "./data/apps/"

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

    new_app_json = {
        "configs": [app_config_json],
        "icon": "null",
        "categories": ["other"],
        "description": {"en": "null"}
    }

    app_file_path = APP_DATA_PATH + new_app_json["configs"][0]["id"] + ".json"

    if os.path.exists(app_file_path):
        print(Fore.RED + f"File {app_file_path} already exists. Please try updating an existing config instead.")
        return

    os.makedirs(os.path.dirname(app_file_path), exist_ok=True)

    with open(app_file_path, "w", encoding="utf-8") as app_file:
        json.dump(new_app_json, app_file, indent=4, ensure_ascii=False)
        app_file.write('\n')

    print(Fore.GREEN + f"File created at {app_file_path}")

def update_existing_config():
    """Add an additional config to an existing config file."""
    url_input = unquote(input("Input URL to extract JSON from: "))

    if not is_obtainium_url(url_input):
        print(Fore.RED + "Invalid URL. Please try again.")
        return

    app_file_name_input = input("Input file to add config to: ")
    if not app_file_name_input.endswith('.json'):
        app_file_name_input += '.json'
    app_file_path = APP_DATA_PATH + app_file_name_input

    if not os.path.exists(app_file_path):
        print(Fore.RED + f"File {app_file_path} does not exist. Please try creating a new config instead.")
        return

    app_config_json = extract_json_from_obtainium_url(url_input)

    if app_config_json is None:
        return

    with open(app_file_path, "r", encoding="utf-8") as app_file:
        existing_app_data = json.load(app_file)

    existing_app_data["configs"].append(app_config_json)

    for config in existing_app_data["configs"]:
        if 'altLabel' not in config:
            config['altLabel'] = "null"

    with open(app_file_path, "w", encoding="utf-8") as app_file:
        json.dump(existing_app_data, app_file, indent=4, ensure_ascii=False)
        app_file.write('\n')

    print(Fore.GREEN + f"Config added to {app_file_path}")

def main():
    """Main function."""
    print("""
1. Create new app config
2. Add config to already existing app config file
""")
    user_choice = input("Enter your choice: ")

    actions = {"1": create_new_config, "2": update_existing_config}

    if user_choice in actions:
        actions[user_choice]()
    else:
        print(Fore.RED + "Invalid choice")

if __name__ == "__main__":
    main()
