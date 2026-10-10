import pytest

from freerec.kinds import detect_kind, kind_from_extension

PAD26 = b" " * 26


@pytest.mark.parametrize(
    ("kind", "head", "name"),
    [
        ("pdf", b"%PDF-1.7\n", "doc.pdf"),
        ("pdf", b"\xef\xbb\xbf%PDF-1.4", "bom.pdf"),
        ("jpeg", b"\xff\xd8\xff\xe0", "a.jpg"),
        ("png", b"\x89PNG\r\n\x1a\n", "a.png"),
        ("gif", b"GIF89a", "a.gif"),
        ("webp", b"RIFF\x00\x00\x00\x00WEBPVP8 ", "a.webp"),
        ("tiff", b"MM\x00*", "a.tiff"),
        ("avif", b"\x00\x00\x00\x1cftypavif", "a.avif"),
        ("heic", b"\x00\x00\x00\x18ftypheic", "a.heic"),
        ("epub", b"PK\x03\x04" + PAD26 + b"mimetypeapplication/epub+zip", "book.zip"),
        ("docx", b"PK\x03\x04" + b" " * 40, "a.docx"),
        ("xls", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "a.xls"),
        ("azw3", b" " * 60 + b"BOOKMOBI", "a.azw3"),
        ("rtf", b"{\\rtf1", "a.rtf"),
        ("html", b"<!doctype html>", "a.html"),
    ],
)
def test_detects_kinds(kind, head, name):
    assert detect_kind(head, name) == kind


def test_content_wins_over_extension():
    assert detect_kind(b"\xff\xd8\xff", "fake.pdf") == "jpeg"
    assert detect_kind(b"plain text", "fake.pdf") is None
    assert detect_kind(b"PK\x03\x04" + b" " * 40, "archive.zip") is None
    assert detect_kind(b"", "empty.txt") is None


def test_kind_from_extension():
    assert kind_from_extension("PHOTO.JPEG") == "jpeg"
    assert kind_from_extension("README") is None
