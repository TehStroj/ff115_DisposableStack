# Mozilla submission: notes for reviewers

The section below is ready to paste into the **Notes for Reviewers** field.

## Notes for reviewers

This independent, experimental add-on provides missing explicit-resource-
management JavaScript APIs on https://chatgpt.com/ for Firefox desktop ESR
115.31 or later.
It does not claim affiliation with Mozilla or OpenAI, complete language
conformance, or compatibility with every feature of the website.

The add-on ID is `ff115-disposable-stack@tehstroj.github.io`, version 0.1.1.
The unsigned upload archive contains the manifest, two unminified JavaScript
files, and the MIT license. There are no libraries, generated JavaScript,
obfuscation, build-time transforms of JavaScript, remote scripts, background
pages, or runtime dependencies. The complete repository, including the
packaging script and tests, is public:
https://github.com/TehStroj/ff115_DisposableStack

### Permissions and the page-context bridge

The sole host match is `https://chatgpt.com/*`. The manifest requests no other
API permissions. `document_start` is necessary because the APIs must exist
before ordinary page scripts use them. `all_frames` and `match_about_blank`
cover matching/inherited-origin frames where Firefox allows injection; they
do not grant access to arbitrary external hosts.

`content.js` deliberately uses Firefox's `wrappedJSObject`,
`XPCNativeWrapper.unwrap`, and `exportFunction` to expose the polyfill to the
page. Merely defining globals in an isolated content script would not provide
them to the website. The bridge consistently unwraps receivers and arguments
so WeakMap identity, page symbol methods, and subclass prototypes work across
Firefox's wrappers. A page-realm Proxy preserves constructor `new.target`.
The returned objects, errors, and promises are created using page constructors.

Exported callbacks implement only disposal operations. They do not expose
extension APIs, file access, network access, messages, or other privileged
capabilities. Stack state is kept in private WeakMaps. The installer itself
is not exported to the page. No eval, Function constructor, or DOM script-tag
injection is used, so page CSP exceptions are unnecessary.

### Data handling

There is no data collection or transmission. No page-content scanning, input
listeners, persistent storage, telemetry, analytics, or network calls are
present. Resource objects and callbacks registered by the page are held only
as in-memory disposal state. The manifest declares
`data_collection_permissions.required: ["none"]`. No older-Firefox consent
dialog is needed because no data is collected. See PRIVACY.md in the source
repository for the public privacy policy.

### Manual API check

Use Firefox ESR 115, install the submitted add-on, then reload
https://chatgpt.com/. In the page's Web Console (Ctrl+Shift+K), check:

```js
typeof DisposableStack      // "function"
typeof AsyncDisposableStack // "function"
typeof Symbol.dispose      // "symbol"
typeof Symbol.asyncDispose // "symbol"
const s = new DisposableStack();
s.use({ [Symbol.dispose]() { console.log("cleanup works"); } });
s.dispose();                // logs "cleanup works"
s.disposed;                 // true
```

The API check does not require access to Codex itself; the live Codex workflow
does require the reviewer's own eligible website account. No credentials are
embedded in the add-on or supplied by this repository. Newer Firefox versions
may already provide these APIs, so they cannot establish that the polyfill
works on 115. Existing native implementations are preserved.

### Automated checks and packaging

From the repository root, maintained Node.js 22+ and Python 3.12+ suffice for:

```sh
npm test
npm run build
npm run package:submission
```

There is no npm installation or transpilation step. `scripts/package.py`
packages the source verbatim (with JSON manifest serialization) and adds the
MIT license. `submission/SHA256SUMS` identifies the unsigned upload artifact
and its matching `-sources.zip`. The source archive includes all readable
source, tests, build scripts, and `BUILDING.md` with exact instructions.
The normal build in `dist/` and the upload archive are byte-for-byte identical.

Only maintained Python 3.12+ and its standard library are needed to build;
there are no dependencies to download or lock. Optional unit tests use Node.js
22+ (24 LTS recommended). Packaging was validated on Debian 13 x86-64 with
Python 3.12.14 and zlib 1.3.2. Builds do not depend on architecture or on an
outdated browser tool. The optional browser suite is a separate validation step.

To compare a submitted unsigned XPI with the source, run:

```sh
python3 scripts/verify_package.py /path/to/ff115-disposable-stack-0.1.1.xpi
```

It rebuilds and checks the exact archive file set and every file's bytes,
including the manifest and license. Duplicate or unexpected files fail. See
BUILDING.md for tool installation links and the complete review-build process.

For the real-browser suite, supply a compatible desktop Firefox 115.31+ that
lacks native DisposableStack and a compatible geckodriver:

```sh
FIREFOX_BINARY=/path/to/firefox GECKODRIVER=/path/to/geckodriver npm run test:firefox
```

This test starts a fresh temporary browser profile and a local fixture server.
It adds `http://127.0.0.1/*` ONLY to a temporary test XPI, not the submitted
package. It verifies early page-script access under restrictive CSP, matching
frames, callbacks, nested stacks, subclasses, page errors, async promises, and
absence on an unmatched host. Test processes and profiles are cleaned up.

The JavaScript suite contains 15 tests, and the browser suite contains 18
checks. Historical validation of the unchanged JavaScript used Linux Firefox
ESR 115.14 and geckodriver 0.34.0 before the new no-data manifest field was added.
That older browser rejects the new manifest field and is no longer supported
by this public package. The owner reported that the original package restored
Codex chatting on Windows 7 and identified the browser as 115.43.1 ESR (64-bit).
This is a user report, not independent testing of every live Codex feature.

The version 0.1.1 manifest and unchanged disposal code also passed all 18
integration checks on Linux Firefox ESR 140.15.0 with geckodriver 0.36.0. That
browser still lacks native DisposableStack (the suite verifies this before
installation). The new manifest was not executed in cloud Firefox 115.31+;
the supported minimum follows the upstream ESR parser fix. See
`docs/validation.md` for the complete validation scope.

### No-data declaration and minimum-version warnings

The public manifest requires **Firefox 115.31.0+**. The older 115 manifest
parser rejected unknown properties in `browser_specific_settings.gecko`;
ESR 115.31 backported a fix to tolerate them. Its purpose here is to accept
the required declaration, not to provide Firefox 140's built-in data-consent
interface. The add-on collects no data, so no legacy consent dialog is needed.

Mozilla's current validator emits these two warnings (and no errors) for the
no-data field with this minimum version:

- `KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION`
- `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`

These warnings concern the metadata key's newer support versions. Android
distribution is not requested. We do not raise the desktop minimum to 140
merely to suppress the warning, because the intended users are on the Windows
7 ESR branch. The current ESR 115 schema accepts unknown properties here:
https://github.com/mozilla-firefox/firefox/blob/esr115/toolkit/components/extensions/schemas/manifest.json

Relevant upstream reports:
https://bugzilla.mozilla.org/show_bug.cgi?id=1996829
https://github.com/uBlockOrigin/uBlock-issues/issues/3894
https://github.com/mozilla/addons-linter/issues/5989

### Policy details

See `docs/policy-checklist.md` for the eight highlighted requirements: host
permission scope, self-contained code, no new-tab override, unchanged CSP,
no remote data transport, minimal archive contents, runtime behavior, and
absence of third-party libraries. Functional tests are not a performance
benchmark; no claim of zero runtime impact is made.

### Known limits

- The API polyfill cannot add parsing of `using` or `await using` syntax.
- Only chatgpt.com and permitted matching frames are covered; workers, service
  workers, external cross-origin frames, and protected pages are outside scope.
- No disposal hook is installed on the hidden page async-iterator prototype.
- Invalid resources remain errors. A plain `.dispose()` method is not treated
  as `[Symbol.dispose]` implicitly.
- Existing native APIs are not replaced. Future changes to the website or
  unrelated unsupported browser features may still break functionality.
- These are focused compatibility checks, not the complete ECMAScript test suite.
