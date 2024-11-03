# Contributing

- To contribute content, create a [pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) with valid changes/additions to any files in the repo.
- To test locally, run: `node buildData.js && python -m http.server 8080`
- See https://github.com/ImranR98/Obtainium/issues/1214 for background/context for this repo.


## Contributing Apps

> [!IMPORTANT]
> Please make sure to read the [app criteria](APP_CRITERIA.md) before opening a PR with new/updated app configs.

- You can auto-generate config files from an Obtainium export by running `node generateFromExport.js <path to Obtainium export>`
- Note: Auto-generated entries will not have icon, category, or description data. Adding those manually is not required but would result in a better user experience.
- You can also auto-generate config files from an Obtainium URL redirection link by running `generate_from_url.py`
- Note: Using `generate_from_url.py` requires you to install "Colorama" by using the `pip` command `pip install colorama`


### Minimal Example

To add an app config to this repo, your app configuration JSON must contain at least the `id`, `url`, `author`, `name`, and `additionalSettings` keys. Note that for any app-specific setting you don't define in `additionalSettings`, the default value will be used.

For example:
- Minimal app JSON: `{"id":"dev.patrickgold.florisboard.beta","url":"https://github.com/florisboard/florisboard","author":"florisboard","name":"FlorisBoard Beta","additionalSettings":"{\"includePrereleases\":true}"}`
- As URL: http://apps.obtainium.imranr.dev/redirect.html?r=obtainium://app/%7B%22id%22%3A%22dev.patrickgold.florisboard.beta%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fflorisboard%2Fflorisboard%22%2C%22author%22%3A%22florisboard%22%2C%22name%22%3A%22FlorisBoard%20Beta%22%2C%22additionalSettings%22%3A%22%7B%5C%22includePrereleases%5C%22%3Atrue%7D%22%7D
