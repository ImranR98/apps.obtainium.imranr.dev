# Badging Your Own Project

You do not need to add your app to this directory to use Obtainium's deep link. If your project
has its own README or homepage, you can link straight to an Obtainium import using the same JSON
shape the directory entries use, with no listing here involved.

## Get the badge

Copy `assets/graphics/badge_obtainium.png` from the
[Obtainium repo](https://github.com/ImranR98/Obtainium/tree/main/assets/graphics) and host it
yourself. Hotlinking `raw.githubusercontent.com` directly is discouraged: GitHub does not
guarantee that endpoint for hotlinking, and it can rate-limit. The file ships with transparent
padding; most projects trim it and display it around 161x48 (its 3.36:1 aspect ratio).

## Pick a link form

Both take the same URL-encoded JSON as the directory entries above, at minimum `id`, `url`,
`author`, `name`:

- `obtainium://app/<encoded json>` - the bare scheme link. No third party involved, but it does
  nothing if tapped without Obtainium installed (desktop, or a phone that does not have it yet),
  and most browsers offer no fallback.
- `https://apps.obtainium.imranr.dev/redirect?r=obtainium://app/<encoded json>` - this site's
  redirect page. It validates the payload, attempts the app link, and after a couple of seconds
  without a response shows a working "get Obtainium" link instead of a dead one. Carries this
  site's analytics and ad script.

Most projects badging themselves use the second form so the badge still does something useful for
a visitor who does not have Obtainium yet.

## Example

Badging a project at `github.com/example/app`:

```
{"id":"com.example.app","url":"https://github.com/example/app","author":"example","name":"Example App"}
```

As a redirect URL:

```
https://apps.obtainium.imranr.dev/redirect?r=obtainium://app/%7B%22id%22%3A%22com.example.app%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fexample%2Fapp%22%2C%22author%22%3A%22example%22%2C%22name%22%3A%22Example%20App%22%7D
```

The `id` is only a bookkeeping key on the installing device. It does not need to match anything in
this directory and has nothing to do with submitting your app as a listing (see
[Contributing Apps](CONTRIBUTING.md#contributing-apps)).

## Seen in the wild

A few projects already badge themselves this way:

- [Delta Chat](https://delta.chat/en/download)
- [PrivacyNotes](https://privacynotes.app/#downloads)
