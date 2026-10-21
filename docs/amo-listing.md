# Mozilla Add-ons listing — version 0.1.2

Copy the field contents below into the Mozilla Add-ons Developer Hub. This is
an experimental release submission; it has not been signed or approved by
Mozilla yet. Publishing remains a separate action in your Mozilla account.

## Submission settings

- Distribution: **On this site** (public listing on addons.mozilla.org).
- Mark **This add-on is experimental**.
- Platforms for this initial release: **Windows and Linux**, Firefox desktop.
  Do not select Firefox for Android. macOS has not been tested.
- Manifest compatibility entry: **115.0** (AMO's base-version entry).
- Practical minimum: **115.31.0**. Older 115 builds reject the required no-data
  manifest field and are not supported. Keep this requirement in the public
  description. AMO rejected `115.31.0` as an unknown catalog entry.
- License: **MIT**.
- Suggested category: **Other**; select **Web Development** as a second
  category if appropriate in the current form.
- Payment requirement: the add-on is free. It adds no paid feature; access to
  ChatGPT or Codex remains subject to the website's own account and plan rules.
- Data collection: **none**. The manifest declares `required: ["none"]`.

## Name

```text
DisposableStack for Firefox 115
```

## Summary

```text
Adds missing JavaScript disposal APIs to ChatGPT and Codex on Firefox ESR 115.31+. No data collection or network requests.
```

## Description

Paste the following text into the description field:

```text
An experimental compatibility add-on for people using ChatGPT and Codex with Firefox ESR 115.31 or later, including the Windows 7 release line.

Some website code expects newer JavaScript resource-management APIs. This small add-on supplies DisposableStack, AsyncDisposableStack, SuppressedError, Symbol.dispose, and Symbol.asyncDispose when they are missing. It also adds synchronous iterator disposal. Existing implementations are left in place. No userscript manager is needed.

Permissions and privacy

The add-on runs only on https://chatgpt.com/ and matching frames. Firefox's site-access permission is needed to install the APIs in the page's own JavaScript context before ordinary page scripts run.

It does not scan page content, monitor typing, or collect conversations. It has no telemetry, analytics, background process, persistent storage, network requests, or remotely loaded code. Its source is public and licensed under MIT.

Getting started

Firefox 115.31 or later is required because older 115 builds reject Mozilla's new manifest declaration. Mozilla's compatibility metadata uses the 115.0 base-version entry; this does not mean 115.0–115.30 are supported. Update to a current ESR 115 patch before installing. After installing, reload any open ChatGPT or Codex tabs. The signed Mozilla version installs normally and does not require turning off Firefox's add-on signature verification.

Limitations

This is a focused API polyfill, not a browser engine upgrade. It cannot add support for parsing using or await using declarations, fix unrelated missing browser features, or guarantee that future ChatGPT/Codex updates will work on Firefox 115.

It runs only on chatgpt.com. It does not cover workers, service workers, cross-origin frames outside that host, or Firefox-protected pages. It does not add a disposal hook to the hidden async-iterator prototype. An object with no disposal method is still rejected instead of silently skipping cleanup.

The original implementation passed automated checks in Linux Firefox ESR 115.14 before the new manifest declaration was added. The public package's new manifest and the same disposal code passed 18 integration checks in Linux Firefox ESR 140.15, which still lacks native DisposableStack. The project owner also reported successful Codex chatting on Windows 7/Firefox 115 and identified their browser as 115.43.1 ESR (64-bit). These are focused compatibility checks, not complete ECMAScript conformance or broad testing of every ChatGPT/Codex feature.

This is an independent project, not affiliated with or endorsed by Mozilla or OpenAI. It does not make an older browser secure or replace browser security updates. Access to ChatGPT/Codex remains subject to the website's own availability and account requirements.

Source and support: https://github.com/TehStroj/ff115_DisposableStack
Report problems: https://github.com/TehStroj/ff115_DisposableStack/issues
```

## Links

- Homepage: <https://github.com/TehStroj/ff115_DisposableStack>
- Support website: <https://github.com/TehStroj/ff115_DisposableStack/issues>
- Privacy policy:
  <https://github.com/TehStroj/ff115_DisposableStack/blob/main/PRIVACY.md>
- License:
  <https://github.com/TehStroj/ff115_DisposableStack/blob/main/LICENSE>

Use your own support email if the form requires one. Do not use an invented
address. If the form requests the privacy-policy text, copy the contents of
`PRIVACY.md`.

## Release notes

```text
Initial public experimental release.

- Corrects the AMO upload minimum-version entry after the 0.1.1 submission was rejected as unknown. The practical requirement remains Firefox 115.31 or later.

- Adds missing DisposableStack, AsyncDisposableStack, SuppressedError, and disposal symbols to chatgpt.com.
- Includes synchronous iterator disposal and page-context integration for Firefox ESR 115.
- Limits site access to chatgpt.com; no data collection or network requests.
- Includes an MIT license and Mozilla's explicit no-data-collection declaration.
- Validated with JavaScript tests and real Firefox ESR 115 integration tests; a user also reported success with Codex on Windows 7/Firefox 115.
```

## Reviewer notes

Paste the contents under **Notes for reviewers** in
[reviewer-notes.md](reviewer-notes.md) into the private reviewer-notes field.

## Official submission references

- [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [Data-collection declarations](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
