# [apps.obtainium.imranr.dev](https://apps.obtainium.imranr.dev)

Crowdsourced App Configurations website for [Obtainium](https://github.com/ImranR98/Obtainium).

The website is accessible at [apps.obtainium.imranr.dev](https://apps.obtainium.imranr.dev)

Analytics: https://plausible.imranr.dev/apps.obtainium.imranr.dev/

## About

This website has **two** main parts:

- URL Redirection page (redirect.html)
- Crowdsourced app configs (main page)

For contributing new configs see the [contributing guidelines](CONTRIBUTING.md). For how to use the redirection page, see below:


### URL Redirection

Obtainium's custom protocol links (`obtainium://`) may not be easily clickable (for example, neither GitHub's MarkDown renderer nor popular messaging apps like WhatsApp support them). To work around this, you can use the web-based redirect to get a normal `http://` link that opens a webpage which redirects to Obtainium (if installed).

For example:
- Raw Obtainium link: `obtainium://add/https://github.com/florisboard/florisboard`
- Clickable redirect version: http://apps.obtainium.imranr.dev/redirect.html?r=obtainium://add/https://github.com/florisboard/florisboard


### Link Types

As of this writing, there are two types of Obtainium links:

1. `/add`: These redirect the user to the "Add App" page with the URL pre-filled in. The user can then modify any app-specific setting before adding it themselves.
2. `/app`: These links contain an entire app configuration JSON and opening them in Obtainium results in the app being added directly into the user's list, with the app-specific settings included in the link.
   - Example: http://apps.obtainium.imranr.dev/redirect.html?r=obtainium://app/%7B%22id%22%3A%22dev.patrickgold.florisboard.beta%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fflorisboard%2Fflorisboard%22%2C%22author%22%3A%22florisboard%22%2C%22name%22%3A%22FlorisBoard%20Beta%22%2C%22preferredApkIndex%22%3A0%2C%22additionalSettings%22%3A%22%7B%5C%22includePrereleases%5C%22%3Atrue%2C%5C%22fallbackToOlderReleases%5C%22%3Atrue%2C%5C%22filterReleaseTitlesByRegEx%5C%22%3A%5C%22%5C%22%2C%5C%22filterReleaseNotesByRegEx%5C%22%3A%5C%22%5C%22%2C%5C%22verifyLatestTag%5C%22%3Afalse%2C%5C%22dontSortReleasesList%5C%22%3Afalse%2C%5C%22trackOnly%5C%22%3Afalse%2C%5C%22versionDetection%5C%22%3A%5C%22standardVersionDetection%5C%22%2C%5C%22apkFilterRegEx%5C%22%3A%5C%22%5C%22%2C%5C%22autoApkFilterByArch%5C%22%3Atrue%2C%5C%22appName%5C%22%3A%5C%22%5C%22%2C%5C%22exemptFromBackgroundUpdates%5C%22%3Afalse%2C%5C%22skipUpdateNotifications%5C%22%3Afalse%2C%5C%22about%5C%22%3A%5C%22%5C%22%7D%22%7D


## Badge Graphic

You may want to use the following graphic to link users to your App:

![Get it on Obtainium](https://raw.githubusercontent.com/ImranR98/Obtainium/main/assets/graphics/badge_obtainium.png)

With padding:

![badge_obtainium_padded](https://github.com/user-attachments/assets/713d71c5-3dec-4ec4-a3f2-8d28d025a9c6)

