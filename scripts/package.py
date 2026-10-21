"""Build a deterministic unsigned XPI using only the Python standard library."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "extension"


def add_file(archive, name, data):
    info = zipfile.ZipInfo(name, date_time=(2025, 1, 1, 0, 0, 0))
    info.create_system = 3
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    archive.writestr(info, data)


def package(destination, manifest=None):
    if manifest is None:
        manifest = json.loads((SOURCE / "manifest.json").read_text())
    if any(mark in manifest["name"].casefold() for mark in ("mozilla", "firefox")):
        raise ValueError("AMO submission names must not contain Mozilla or Firefox trademarks")
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in ("manifest.json", "polyfill.js", "content.js", "LICENSE"):
            if name == "manifest.json":
                data = (json.dumps(manifest, indent=2) + "\n").encode()
            elif name == "LICENSE":
                data = (ROOT / "LICENSE").read_bytes()
            else:
                data = (SOURCE / name).read_bytes()
            add_file(archive, name, data)
    return destination


def package_sources(destination):
    # Explicit paths/suffixes exclude Git metadata, caches, local tools, built
    # artifacts, and credentials. The source ZIP never includes itself.
    files = [ROOT / name for name in (
        "README.md", "BUILDING.md", "LICENSE", "PRIVACY.md", "package.json",
        ".gitignore", ".gitattributes", "submission/README.md"
    )]
    for folder, suffixes in (
        ("extension", {".js", ".json"}), ("scripts", {".py"}),
        ("tests", {".js", ".cjs", ".py"}), ("docs", {".md"})
    ):
        files.extend(path for path in (ROOT / folder).iterdir() if path.is_file() and path.suffix in suffixes)
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(files):
            add_file(archive, path.relative_to(ROOT).as_posix(), path.read_bytes())
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--submission", action="store_true", help="Write the unsigned XPI, matching sources, and SHA256SUMS to submission/.")
    args = parser.parse_args()
    version = json.loads((SOURCE / "manifest.json").read_text())["version"]
    folder = ROOT / ("submission" if args.submission else "dist")
    output = package(folder / f"ff115-disposable-stack-{version}.xpi")
    if args.submission:
        sources = package_sources(folder / f"ff115-disposable-stack-{version}-sources.zip")
        checksums = "".join(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n" for path in (output, sources))
        (folder / "SHA256SUMS").write_bytes(checksums.encode("ascii"))
        print(sources)
    print(output)
