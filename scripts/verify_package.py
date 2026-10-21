"""Compare an unsigned upload XPI against a fresh build of this source tree."""
import argparse
import json
from pathlib import Path
import tempfile
import zipfile

from package import ROOT, package


def contents(path):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise SystemExit(f"Duplicate ZIP entries in {path}")
        return {name: archive.read(name) for name in names}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="ff115-verify-") as folder:
        expected = contents(package(Path(folder) / "expected.xpi"))
    actual = contents(args.archive)
    if actual != expected:
        changed = sorted(name for name in set(actual) | set(expected) if actual.get(name) != expected.get(name))
        raise SystemExit("Package differs from source: " + ", ".join(changed))
    version = json.loads(actual["manifest.json"])["version"]
    print(f"PASS: all {len(actual)} files in version {version} match the source build exactly.")


if __name__ == "__main__":
    main()
