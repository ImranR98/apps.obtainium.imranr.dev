# App Criteria

Hey,

Before opening a new app request/PR with updates to a config, please read the following information to ensure that the app you want is suitable for this site. It will save you and the maintainers of the repo time. If you choose to ignore these instructions, your request/PR may be ignored.


### Before opening an app request:

1. Check the config website to see if the app you want is already available there.

2. Search in both open AND closed discussions to see if this app has already been requested by someone else.

3. Check if the app is a **simple config** - see below.

4. Forks of apps will not be accepted, unless both the package name and display name of the app has been changed. This is to avoid people downloading non-official versions of apps.

5. Only configs from official sources from the app are accepted. This means reupload site (eg. APKPure, APKMirror etc...) configs will NOT be added.


If you have read through and understand the above, then you can [open an app request](https://github.com/ImranR98/apps.obtainium.imranr.dev/discussions/new?category=app-requests). Make sure to include at a minimum:

- The link from where you can download the APK.
- What you have tried to get the app working so far. If you have a working config, consider creating a PR yourself.


### Before opening a PR:

1. Search in both open AND closed PRs to see if someone has already tried to add the app at some point, and if it was declined, the reason why.

2. Do not add apps that are **simple configs** - see below.

3. Forks of apps will not be accepted, unless the app ID and name has been changed. This is to avoid people downloading non-official versions of apps without them knowing.

4. Forks of apps will not be accepted, unless both the package name and display name of the app has been changed. This is to avoid people downloading non-official versions of apps.


If you have read through all this and understand, then you can open an PR. Keep these things in mind:

- Keep the amount of alternative configs to a minimum, only provide the ones that will work the best in the long term.
- Ensure that you leave as many config options as you can as the default setting. Only change what you need. For example, with a GitHub config you would not add an app with the `Include prereleases` setting enabled unless necessary as not everyone will want prereleases.


### What is a simple config?

A simple config is an app that you can add by simply pasting the URL of the website and clicking add in Obtainium, without changing any additional settings.

The exception to this is if the URL may be hard to find. For example, the URL which has the links to Signal APKs (https://updates.signal.org/android/latest.json) is not easy to find unless you have knowledge of browser developer tools.
