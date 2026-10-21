# Submission policy checklist

This records the implementation and evidence for the highlighted Mozilla
requirements. It is a review aid, not Mozilla approval or a guarantee of
future website compatibility.

| Requirement | Implementation and evidence |
| --- | --- |
| Request only necessary permissions | The only host match is `https://chatgpt.com/*`. There are no additional API permissions, broad host patterns, or background scripts. Matching frame injection installs the same compatibility API where the site's frame scripts need it. |
| Be self-contained; no remote code | The XPI includes readable `content.js` and `polyfill.js`, its manifest, and the required MIT license. No remote script, dynamic code evaluation, message-based code loading, or runtime dependency is used. |
| No remote new-tab page | There is no new-tab override, browser/homepage override, tab creation, navigation, or redirect code. |
| Do not relax page security headers | No webRequest permission or header interception exists. The Firefox page-context bridge neither modifies CSP nor injects eval/script tags. The browser suite exercises a page whose CSP permits only nonce-bearing page scripts. |
| Encrypt remote data transport | The add-on transports no data and makes no network requests; this requirement introduces no transport mechanism. The original website's own traffic remains its responsibility. |
| Avoid redundant packaged files | The XPI has exactly four necessary files: the manifest, two JavaScript files, and license. Source ZIPs, tests, build tools, docs, caches, and checksums are separate submission material and are not installed. `scripts/verify_package.py` rejects extra or different XPI files. |
| Protect performance and stability | There is no background process, DOM scanning, input listener, timer, polling, or persistent storage. Installation runs once per matched document. Disposal work scales with the page's registered resources; state is private and cleanup is idempotent. The focused suites check callbacks, reentrancy, ownership, and continued cleanup after failures. They are not a performance benchmark or a guarantee against all site interactions. |
| Use unmodified release versions of third-party libraries | No third-party libraries or frameworks are shipped. The local build uses only maintained Python's standard library and downloads no dependencies. Optional lint is obtained through the official npm registry; it is a development tool and is not included in the add-on or needed for a review build. |

The manifest also declares no data collection. Firefox 115.31+ is required to
accept this metadata, as explained in [reviewer notes](reviewer-notes.md).
The public description and [privacy policy](../PRIVACY.md) disclose the host
permission and the intended behavior.

The source submission includes `BUILDING.md` and scripts to recreate and compare
the upload XPI without any network access, credentials, or third-party build
packages. Runtime code is readable, unchanged JavaScript. There is no
obfuscation or remote resource used to hide the add-on's behavior.

## Data, consent, and private browsing

The add-on neither collects nor transmits personal data, technical data,
interaction metrics, search terms, browsing history, or page content outside
the local browser. It has no search integration or native messaging. It sends
no ancillary data and implements no remote recipient, identifier, account,
analytics beacon, or cookie mechanism. No data-transmission consent UI is
needed for this no-data implementation; the manifest explicitly declares
`required: ["none"]`.

Resource references and callbacks live only in per-document in-memory stack
state while needed for disposal. There is no extension storage, cross-session
identifier, container-tracking mechanism, or private-browsing data store.
Firefox controls whether the add-on may run in private windows. The add-on
does not change that setting or retain data from a private session.

The host page's own requests and account behavior are separate. The add-on
does not add recipients, interception, or data transmission to them. The public
privacy policy discloses this distinction and explains that any support
information users voluntarily post to GitHub is public and is not submitted
automatically by the add-on.
