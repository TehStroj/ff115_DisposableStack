# DisposableStack for Firefox 115

A small, readable Firefox add-on that provides missing JavaScript resource
management APIs on **https://chatgpt.com/**, including Codex. Intended for
Firefox ESR **115.31 or later** on Windows 7. No Tampermonkey is needed.

It provides `DisposableStack`, `AsyncDisposableStack`, `SuppressedError`,
`Symbol.dispose`, and `Symbol.asyncDispose`. Existing implementations are left
alone. It also adds synchronous iterator disposal, so closing a generator can
run its `finally` block.

The project is licensed under [MIT](LICENSE). It is an **experimental**
compatibility tool, independently developed and not affiliated with Mozilla
or OpenAI. It does not make an older browser secure or replace browser
security updates.

## Public release submission

The [submission directory](submission/) contains the prepared **unsigned**
version 0.1.2 XPI, matching source ZIP, and their SHA-256 checksums. They are prepared for upload through the
Mozilla Developer Hub, but has not been signed or approved by Mozilla.
[Listing text](docs/amo-listing.md), [reviewer notes](docs/reviewer-notes.md),
and a [privacy policy](PRIVACY.md) are included. The intended first public
listing is experimental, for Windows and Linux desktop users.

Version 0.1.2 requires **115.31.0+ in practice** because earlier 115 builds reject
Mozilla's now-required no-data manifest field. The manifest declares the
`115.0` base-version entry for AMO compatibility metadata: AMO's upload server
rejected the exact ESR patch value `115.31.0` as unknown. This does not make
115.0–115.30 supported. The 115.31 parser fix accepts unknown
properties in this section; the newer built-in data-consent UI is not needed
because this add-on collects no data. The project owner's current test setup
is Windows 7 with Firefox **115.43.1 ESR (64-bit)**.

## Try it in Firefox

1. Download this repository and extract it to a folder.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on…** and select `extension/manifest.json`.
   Alternatively, select the built `.xpi` using the same button.
4. Reload the ChatGPT/Codex tab. Existing tabs need a reload.

Temporary add-ons are removed when Firefox closes. A normal permanent install
in a standard Firefox configuration requires **Mozilla signing**. This
repository produces an **unsigned** XPI; it is not a signed release. Submit it
through Mozilla's developer hub with **On this site** for public distribution,
or **On your own** for unlisted distribution, and install the signed version
Mozilla provides. No signing credentials are needed to build or temporarily
test the add-on. Users of a signed release should keep add-on signature
verification enabled.

The development/test commands below are not needed on your Windows 7 machine.

## Check that it loaded

On `chatgpt.com`, open Firefox's page console (Ctrl+Shift+K) and type:

```js
typeof DisposableStack          // "function"
typeof Symbol.dispose           // "symbol"
typeof AsyncDisposableStack     // "function"

const stack = new DisposableStack();
stack.use({ [Symbol.dispose]() { console.log("cleanup works"); } });
stack.dispose();                // prints "cleanup works"
stack.disposed;                 // true
```

If Codex still shows the red error square, check the console for the actual
exception and its stack trace. Passing these checks establishes that the API
is available; it does not establish that every current Codex feature supports
Firefox 115.

## Why “object is not disposable” can still happen

`stack.use(resource)` needs a **function at `resource[Symbol.dispose]`**.
An asynchronous stack accepts `resource[Symbol.asyncDispose]` and falls back to
`resource[Symbol.dispose]`. A method merely named `.dispose()` is not sufficient.
The resource and the stack must use the same symbol, in the page's context.
This add-on installs the symbols and APIs together before ordinary page scripts
and makes stacks themselves disposable.

An ordinary object with no disposal method is still rejected. Silently accepting
it could skip real cleanup. Callers can register a differently named cleanup
method explicitly with `stack.adopt(resource, r => r.dispose())`.

This is an API polyfill, not a new JavaScript engine. It **cannot add parsing of
`using` or `await using` declarations**, nor fix unrelated unsupported browser
features. Workers, service workers, cross-origin frames outside the configured
host, and Firefox-protected pages are outside its scope. It does not add a
disposal hook to the hidden page async-iterator prototype. Async resources that
provide their own disposal method work normally.

## Permissions and privacy

The shipped manifest allows injection **only on `https://chatgpt.com/*`** and
matching frames. It has no background script, telemetry, storage, cookies API,
request interception, external dependencies, or network calls. It does not scan
page content or listen to input. As with any script allowed on a site, its
permission would technically allow access to that site's page content; the
small source here can be inspected in full.

The manifest explicitly declares no data collection, as required for new
Mozilla submissions. [PRIVACY.md](PRIVACY.md) describes the data handling.

`content.js` uses Firefox's `wrappedJSObject` and `exportFunction` to share the
API with the page. Prototypes, returned objects, errors, and promises belong to
the page. Private state is kept in `WeakMap`s. No `eval`, injected script tag,
remote script, page-to-extension message channel, or privileged API is used.
This also avoids depending on the page's permission for inline scripts or eval.

For another site, add its exact HTTPS match pattern to
`extension/manifest.json` → `content_scripts[0].matches`, then reload the add-on
and page. Broad access to all websites is intentionally not requested.

## Develop and build

Packaging requires maintained Python 3.12+; tests use maintained Node.js 22+
(24 LTS recommended). No package installation is needed. See
[BUILDING.md](BUILDING.md) for the exact source-submission build instructions.

```sh
npm test
npm run build
```

The build produces `dist/ff115-disposable-stack-0.1.2.xpi`, a deterministic ZIP
containing only `manifest.json`, `polyfill.js`, `content.js`, and `LICENSE`.
Tests and build tools are not shipped in the add-on. To refresh the committed
Mozilla upload artifact and checksum, run `npm run package:submission`.

Validate the source and submission package with Mozilla's checker (this
optional development tool is downloaded from npm; the add-on has no runtime
dependencies):

```sh
npx --yes --package=web-ext@10.8.0 web-ext lint --source-dir extension
npx --yes --package=web-ext@10.8.0 web-ext lint --source-dir submission/ff115-disposable-stack-0.1.2.xpi
```

Two minimum-version warnings for the new no-data declaration are expected;
the ESR 115.31 parser compatibility fix permits it without implementing the
newer data-consent UI. [Reviewer notes](docs/reviewer-notes.md) explain this.
The upload server performs a separate version-catalog check that this local
linter does not perform. A local pass does not establish AMO acceptance.

For real browser tests, install desktop Firefox 115.31+ without native
`DisposableStack` and a compatible geckodriver, then run:

```sh
FIREFOX_BINARY=/path/to/firefox GECKODRIVER=/path/to/geckodriver npm run test:firefox
```

The integration test uses a fresh temporary profile, installs a temporary test
copy of the add-on, and serves local test pages with a restrictive Content
Security Policy. Only that temporary copy allows the local test host. It checks
availability to the first page script, exported constructors and subclasses,
cleanup callbacks, error identity, async promises, nested stacks, matching
frames, and absence on an unmatched host. Its browser must lack native
`DisposableStack`, so a newer browser cannot give a misleading pass.

The JavaScript suite tests reverse disposal order, callback receivers, method
capture, ownership transfer, idempotence, error suppression, invalid resources,
async fallback, and preservation of existing implementations. These are focused
compatibility tests, not a claim of complete ECMAScript conformance.

The original package passed all 15 JavaScript tests and 18 integration checks
on Linux ESR 115.14 with geckodriver 0.34.0. A user also reported that it restored
Codex chatting on Windows 7/Firefox 115. The Windows patch version, macOS,
Android, and every feature of the live ChatGPT/Codex service have not been
independently tested. The owner subsequently identified the browser as Windows
7/Firefox 115.43.1 ESR (64-bit). The version 0.1.2 manifest and unchanged disposal
code passed all 18 checks on Linux ESR 140.15 with geckodriver 0.36.0, a browser
that also lacks native DisposableStack. The new manifest has not been run in a
cloud 115.31+ browser. See [validation scope](docs/validation.md).

References: [resource management specification](https://tc39.es/proposal-explicit-resource-management/),
[Firefox page/content script sharing](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts),
[temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/),
[signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).
