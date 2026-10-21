# Version 0.1.2 validation scope

- **15 JavaScript tests pass** using Node.js 24.19.0. They exercise the
  polyfill in fresh realms without native disposal globals.
- **18 browser integration checks pass** using Linux Firefox ESR 140.15.0 and
  geckodriver 0.36.0 with the version 0.1.2 manifest. The suite first verifies
  that DisposableStack is absent without the add-on, so this exercises the
  exported polyfill rather than native support.
- The original 0.1.0 implementation previously passed the same 18 checks on
  Linux ESR 115.14.0. Its disposal JavaScript is unchanged in 0.1.2.
- The owner reported successful Codex chatting on Windows 7/Firefox 115 and
  identified their browser as **115.43.1 ESR (64-bit)**. The updated public
  manifest has not yet been independently tested in that Windows session or
  in a cloud 115.31+ browser.
- A direct install attempt on Linux ESR 115.14 confirms that the new no-data
  manifest field is rejected there. The practical requirement is **115.31.0+**,
  following the upstream ESR parser compatibility fix. The manifest uses the
  **115.0** AMO base-version entry, because the upload server rejected the
  exact `115.31.0` catalog entry in version 0.1.1. Older 115 patches remain
  unsupported; the requirement is disclosed in the listing. We do not silently strip the field
  from the browser test or upload package.
- Mozilla `web-ext` 10.8.0 validates the source directory and upload XPI with
  **zero errors and two known minimum-version warnings** for the no-data field.
  [Reviewer notes](reviewer-notes.md) list the warning codes and upstream links.
  This does not test the upload server's additional application-version lookup
  or establish that Mozilla has accepted, signed, or approved this version.
- The upload package's JavaScript and license match their sources verbatim.
  The manifest matches its documented JSON serialization. The source archive
  is rebuilt in a clean temporary directory and compared with the upload XPI
  using `scripts/verify_package.py` before submission artifacts are committed.

The browser tests cover the first ordinary page script, restrictive CSP,
matching frames, host restriction, constructors/subclasses, object identity,
callbacks, nested stacks, errors, sequential async disposal, and iterator
cleanup. The test-only local host match is absent from the public manifest.

These checks do not constitute the complete ECMAScript conformance suite, a
performance benchmark, a full security audit, Mozilla signing/approval, or
testing of every live ChatGPT/Codex feature. macOS and Android have not been
tested. Signing and public publication remain separate actions in the
maintainer's Mozilla account.
