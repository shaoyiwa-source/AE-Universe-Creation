from pathlib import Path
import zipfile, hashlib, json
qa = Path(__file__).resolve().parent
root = qa.parents[1]
for name in ["artwork-and-shop.zip", "original-media.zip"]:
    with zipfile.ZipFile(qa / name) as archive:
        for entry in archive.infolist():
            path = Path(entry.filename)
            if path.is_absolute() or ".." in path.parts or path.parts[0] != "src":
                raise ValueError("Unsafe archive path")
        archive.extractall(root)
expected = json.loads((qa / "source-sha256.json").read_text())
for name, digest in expected.items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
print(f"Verified {len(expected)} exact source files")
