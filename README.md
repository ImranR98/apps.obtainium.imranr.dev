# [apps.obtainium.imranr.dev](https://apps.obtainium.imranr.dev)

Crowdsourced App Configurations website for [Obtainium](https://github.com/ImranR98/Obtainium).

The website is accessible at [apps.obtainium.imranr.dev](https://apps.obtainium.imranr.dev)

## URL Redirection

Obtainium's custom protocol links (`obtainium://`) may not be easily clickable (for example, neither GitHub's MarkDown renderer nor popular messaging apps like WhatsApp support them). To work around this, you can use the web-based redirect to get a normal `http://` link that opens a webpage which redirects to Obtainium (if installed).

For example:
- Raw Obtainium link: `obtainium://add/https://github.com/florisboard/florisboard`
- Clickable redirect version: http://apps.obtainium.imranr.dev/redirect.html?r=obtainium://add/https://github.com/florisboard/florisboard

## Link Types

As of this writing, there are two types of Obtainium links:

1. `/add`: These redirect the user to the "Add App" page with the URL pre-filled in. The user can then modify any app-specific setting before adding it themselves.
2. `/app`: These links contain an entire app configuration JSON and opening them in Obtainium results in the app being added directly into the user's list, with the app-specific settings included in the link.
   - Example: http://apps.obtainium.imranr.dev/redirect.html?r=obtainium://app/%7B%22id%22%3A%22dev.patrickgold.florisboard.beta%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fflorisboard%2Fflorisboard%22%2C%22author%22%3A%22florisboard%22%2C%22name%22%3A%22FlorisBoard%20Beta%22%2C%22preferredApkIndex%22%3A0%2C%22additionalSettings%22%3A%22%7B%5C%22includePrereleases%5C%22%3Atrue%2C%5C%22fallbackToOlderReleases%5C%22%3Atrue%2C%5C%22filterReleaseTitlesByRegEx%5C%22%3A%5C%22%5C%22%2C%5C%22filterReleaseNotesByRegEx%5C%22%3A%5C%22%5C%22%2C%5C%22verifyLatestTag%5C%22%3Afalse%2C%5C%22dontSortReleasesList%5C%22%3Afalse%2C%5C%22trackOnly%5C%22%3Afalse%2C%5C%22versionDetection%5C%22%3A%5C%22standardVersionDetection%5C%22%2C%5C%22apkFilterRegEx%5C%22%3A%5C%22%5C%22%2C%5C%22autoApkFilterByArch%5C%22%3Atrue%2C%5C%22appName%5C%22%3A%5C%22%5C%22%2C%5C%22exemptFromBackgroundUpdates%5C%22%3Afalse%2C%5C%22skipUpdateNotifications%5C%22%3Afalse%2C%5C%22about%5C%22%3A%5C%22%5C%22%7D%22%7D

## Minimal Example

To add an app config to this repo, your app configuration JSON must contain at least the `id`, `url`, `author`, `name`, and `additionalSettings` keys. Note that for any app-specific setting you don't define in `additionalSettings`, the default value will be used.

For example:
- Minimal app JSON: `{"id":"dev.patrickgold.florisboard.beta","url":"https://github.com/florisboard/florisboard","author":"florisboard","name":"FlorisBoard Beta","additionalSettings":"{\"includePrereleases\":true}"}`
- As URL: http://apps.obtainium.imranr.dev/redirect.html?r=obtainium://app/%7B%22id%22%3A%22dev.patrickgold.florisboard.beta%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fflorisboard%2Fflorisboard%22%2C%22author%22%3A%22florisboard%22%2C%22name%22%3A%22FlorisBoard%20Beta%22%2C%22additionalSettings%22%3A%22%7B%5C%22includePrereleases%5C%22%3Atrue%7D%22%7D

## Usage

- To contribute content, create a [pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) with valid changes/additions to the config files in `data/`.
  - You can auto-generate config files from an Obtainium export by running `node generateFromExport.js <path to Obtainium export>`
  - Note: Auto-generated entries will not have icon, category, or description data. Adding those manually is not required but would result in a better user experience.
- To test locally, run: `node buildData.js; python -m http.server 8080`
- See https://github.com/ImranR98/Obtainium/issues/1214 for background/context for this repo.

## Badge Graphic

You may want to use the following graphic to link users to your App:

![Get it on Obtainium](https://raw.githubusercontent.com/ImranR98/Obtainium/main/assets/graphics/badge_obtainium.png)
