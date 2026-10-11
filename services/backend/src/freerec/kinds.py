"""File kind detection by magic bytes.

Mirrors apps/web/src/lib/file-kinds.ts. The browser check is only a UX guard;
this one is authoritative because it runs on the uploaded bytes.
"""

from pathlib import Path

SNIFF_BYTES = 68

EXTENSIONS: dict[str, tuple[str, ...]] = {
    "pdf": (".pdf",),
    "jpeg": (".jpg", ".jpeg"),
    "png": (".png",),
    "webp": (".webp",),
    "gif": (".gif",),
    "avif": (".avif",),
    "heic": (".heic", ".heif"),
    "bmp": (".bmp",),
    "tiff": (".tif", ".tiff"),
    "docx": (".docx",),
    "xlsx": (".xlsx",),
    "pptx": (".pptx",),
    "doc": (".doc",),
    "xls": (".xls",),
    "ppt": (".ppt",),
    "odt": (".odt",),
    "ods": (".ods",),
    "odp": (".odp",),
    "rtf": (".rtf",),
    "txt": (".txt",),
    "html": (".html", ".htm"),
    "epub": (".epub",),
    "mobi": (".mobi",),
    "azw3": (".azw3", ".azw"),
}

_ZIP_KINDS = ("docx", "xlsx", "pptx", "odt", "ods", "odp", "epub")
_OLE_KINDS = ("doc", "xls", "ppt")
_MOBI_KINDS = ("mobi", "azw3")
_TEXT_KINDS = ("txt", "html", "rtf")
_HEIC_BRANDS = {b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1"}


def kind_from_extension(filename: str) -> str | None:
    ext = Path(filename).suffix.lower()
    return next((kind for kind, exts in EXTENSIONS.items() if ext in exts), None)


def _by_extension(candidates: tuple[str, ...], filename: str) -> str | None:
    kind = kind_from_extension(filename)
    return kind if kind in candidates else None


def detect_kind(head: bytes, filename: str) -> str | None:
    """Detects a file's kind from its first SNIFF_BYTES bytes and its name."""
    if b"%PDF-" in head[:SNIFF_BYTES]:
        return "pdf"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"GIF8"):
        return "gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head.startswith(b"BM"):
        return "bmp"
    if head.startswith((b"II*\x00", b"MM\x00*")):
        return "tiff"
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in (b"avif", b"avis"):
            return "avif"
        return "heic" if brand in _HEIC_BRANDS else None
    if head.startswith(b"PK\x03\x04"):
        if head[30:58] == b"mimetypeapplication/epub+zip":
            return "epub"
        return _by_extension(_ZIP_KINDS, filename)
    if head.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return _by_extension(_OLE_KINDS, filename)
    if head[60:68] == b"BOOKMOBI":
        return _by_extension(_MOBI_KINDS, filename) or "mobi"
    if head.startswith(b"{\\rtf"):
        return "rtf"
    if head and b"\x00" not in head:
        return _by_extension(_TEXT_KINDS, filename)
    return None


def detect_file_kind(path: Path, filename: str) -> str | None:
    with path.open("rb") as f:
        return detect_kind(f.read(SNIFF_BYTES), filename)
