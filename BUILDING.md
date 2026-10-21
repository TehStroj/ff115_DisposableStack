# Reproducing the Mozilla submission

These instructions apply to `ff115-disposable-stack-0.1.3-sources.zip` and to
the corresponding repository version. The matching upload XPI is
`ff115-disposable-stack-0.1.3.xpi`. Neither file is Mozilla-signed.

## Build requirements

- A maintained **Python 3.12 or later** with its standard library, including
  `zipfile`/`zlib`. No pip packages are needed.
- Linux, macOS, or Windows can package the source; the build has no architecture-
  specific steps. The packaging has been validated in Debian GNU/Linux 13,
  x86-64, Python 3.12.14, zlib 1.3.2. macOS packaging has not been independently
  exercised. Current supported tooling may be run on a separate machine from
  the Windows 7 browser being supported by the add-on.
- Optional JavaScript tests: maintained **Node.js 22+**, with Node.js 24 LTS
  recommended (validated with 24.19.0). Node and npm are not required to build.

Python and Node are open-source tools available from
[python.org](https://www.python.org/downloads/) and
[nodejs.org](https://nodejs.org/en/download). Reviewers can use maintained OS
packages or their installed tools. No dependency download, shell installer,
third-party library, package-manager install, or network access occurs during
the build. No lockfile is needed: there are no package dependencies.

## Build the unsigned XPI

Extract the matching source ZIP into an empty directory. From the extracted
directory containing this file:

```sh
python3 scripts/package.py
```

On Windows with the Python launcher, use `py -3` in place of `python3`.

Output: `dist/ff115-disposable-stack-0.1.3.xpi`.

This ZIP contains exactly four files at the archive root:

- `manifest.json`: serialized from `extension/manifest.json` using Python's
  JSON library; no feature flags or permission changes are applied.
- `polyfill.js` and `content.js`: byte-for-byte copies from `extension/`.
- `LICENSE`: a byte-for-byte copy of the repository's MIT license.

No transpilation, minification, bundling, code generation, obfuscation, remote
resources, or JavaScript preprocessing occurs. In particular, the readable
JavaScript included in this source ZIP is the JavaScript shipped in the XPI.
The packager also checks that the display name does not contain the reserved
Mozilla or Firefox trademarks, following the upload rejection of version 0.1.2.

## Compare with the uploaded XPI

Save the unsigned XPI submitted to Mozilla somewhere outside the source tree,
then run:

```sh
python3 scripts/verify_package.py /path/to/ff115-disposable-stack-0.1.3.xpi
```

This rebuilds the expected package and compares the entire file set and the
exact bytes of every archived file. It fails if any file is missing, added,
duplicated, or different. ZIP timestamps and compression implementation
differences do not affect this content comparison. Mozilla's eventual signing
files are intentionally not part of the unsigned-package comparison.

`submission/SHA256SUMS` in GitHub identifies the published unsigned XPI and
source ZIP. ZIP metadata is normalized for repeatable builds in the same tool
environment; compressed ZIP bytes can differ across Python/zlib versions even
when all archived file contents match exactly.

To regenerate both upload files and their checksums:

```sh
python3 scripts/package.py --submission
```

The source packager explicitly includes source, documentation, build scripts,
and tests. It excludes Git metadata, caches, installed development tools,
generated archives, and local files outside those declared paths.

## Optional tests and lint

```sh
node --test tests/polyfill.test.cjs
```

For the integration test, supply a desktop Firefox **115.31+** build that lacks
native `DisposableStack`, plus a compatible geckodriver. See README.md for the
browser test command. These browser tools are not build dependencies and are
not included in the add-on or source ZIP. Using a newer Firefox with native
`DisposableStack` fails the test's baseline check to avoid a misleading pass.

Mozilla's optional validator can be installed through the official npm
registry without changing the build:

```sh
npx --yes --package=web-ext@10.8.0 web-ext lint --source-dir dist/ff115-disposable-stack-0.1.3.xpi
```

The validator reports two known minimum-version warnings for the no-data
declaration. See [reviewer notes](docs/reviewer-notes.md). Errors or other new
warnings require investigation. This lint step is optional development
validation and is not run by either packaging script.
