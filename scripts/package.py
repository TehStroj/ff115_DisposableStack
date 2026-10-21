"""Build a deterministic unsigned XPI using only the Python standard library."""
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "extension"


def package(destination, manifest=None):
    if manifest is None:
        manifest = json.loads((SOURCE / "manifest.json").read_text())
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in ("manifest.json", "polyfill.js", "content.js"):
            data = (json.dumps(manifest, indent=2) + "\n").encode() if name == "manifest.json" else (SOURCE / name).read_bytes()
            info = zipfile.ZipInfo(name, date_time=(2025, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    return destination


if __name__ == "__main__":
    version = json.loads((SOURCE / "manifest.json").read_text())["version"]
    print(package(ROOT / "dist" / f"ff115-disposable-stack-{version}.xpi"))
