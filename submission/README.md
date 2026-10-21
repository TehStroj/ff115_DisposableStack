# Mozilla upload package

`ff115-disposable-stack-0.1.3.xpi` is the **unsigned** experimental upload
package, prepared for submission through your Mozilla Add-ons developer account.
`ff115-disposable-stack-0.1.3-sources.zip` contains the matching readable source,
tests, and build instructions. `SHA256SUMS` identifies both exact files. The
public package requires **Firefox 115.31.0 or later**.

**Use version 0.1.3 for a fresh upload.** It renames the add-on to
**DisposableStack Compatibility**, addressing AMO's display-name rejection of
version 0.1.2. It retains the `115.0` base-version entry that replaced the
unrecognized ESR patch entry in version 0.1.1. The public description keeps the
practical 115.31+ requirement explicit. The two documented metadata-version
warnings are separate from those blocking upload checks.

Do not install it as if it were a Mozilla-signed release. Signing and store
approval happen after submission. Uploading the source repository ZIP instead
is incorrect: its manifest is not at the archive root.

1. Download the `.xpi` file using GitHub's **Download raw file** button.
2. Open <https://addons.mozilla.org/developers/addon/submit/>.
3. Choose **On this site** for the public Mozilla listing.
4. Upload this XPI and select Windows and Linux desktop support.
5. Use [the prepared listing](../docs/amo-listing.md), mark the add-on
   **experimental**, choose **MIT**, and provide your real support email if
   requested. Use [the reviewer notes](../docs/reviewer-notes.md) for the private
   reviewer-notes field. The policy text is in [PRIVACY.md](../PRIVACY.md).
6. When asked for source code, upload the matching **`-sources.zip`** separately.
   It includes [BUILDING.md](../BUILDING.md) with exact tool versions, local build
   commands, and a script to compare the uploaded XPI against its source. No
   dependencies or network access are required for the build. The JavaScript is
   already readable and unminified.
7. Submit the version. Validation and any review are handled by Mozilla; a local
   validator pass is not signing or approval.
8. Once Mozilla provides a signed version, install that signed version through
   the listing. Keep Firefox's `xpinstall.signatures.required` preference set to
   `true`; if you previously changed it to `false`, restore it after switching
   to the signed package. Reload ChatGPT/Codex tabs.

Rebuild this directory from the repository root with:

```sh
npm run package:submission
```

Keep the rebuilt XPI and checksum together in version control. The development
build (`npm run build`) writes the same bytes to ignored `dist/` instead.
