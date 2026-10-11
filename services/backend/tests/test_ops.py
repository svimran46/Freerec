"""Conversion ops against real files. They need the converters the worker image ships
(LibreOffice, Ghostscript, qpdf, Calibre, Chromium). Where one is missing these tests
skip, except when FREEREC_REQUIRE_TOOLS=1, as in CI, where a missing tool fails."""

import os
import shutil
import subprocess
import zipfile
from pathlib import Path

import pypdfium2 as pdfium
import pytest
from openpyxl import load_workbook
from pptx import Presentation

from freerec.config import get_settings
from freerec.ops import (
    InputPath,
    NoOptions,
    OpError,
    compress_pdf,
    ebook_convert,
    html_to_pdf,
    office_to_pdf,
    pdf_to_excel,
    pdf_to_powerpoint,
    pdf_to_word,
)
from freerec.ops._tools import output_name

FIXTURES = Path(__file__).parent / "fixtures"


def need(*programs: str) -> None:
    missing = [p for p in programs if shutil.which(p) is None]
    if missing:
        if os.environ.get("FREEREC_REQUIRE_TOOLS") == "1":
            pytest.fail(f"missing converters: {', '.join(missing)}")
        pytest.skip(f"missing converters: {', '.join(missing)}")


@pytest.fixture
def job_dirs(tmp_path: Path) -> Path:
    out = tmp_path / "out"
    out.mkdir()
    return out


def fixture_input(tmp_path: Path, name: str, kind: str, as_name: str | None = None) -> InputPath:
    # The worker stores inputs without extensions; ops must not rely on them.
    path = tmp_path / f"in-{name}"
    shutil.copyfile(FIXTURES / name, path)
    return InputPath(path=path, name=as_name or name, kind=kind)


def pdf_text(path: Path) -> str:
    doc = pdfium.PdfDocument(path)
    try:
        return "\n".join(page.get_textpage().get_text_range() for page in doc)
    finally:
        doc.close()


@pytest.mark.parametrize(
    ("name", "kind", "expected"),
    [
        ("report.docx", "docx", "Quarterly report"),
        ("sales.xlsx", "xlsx", "North"),
        ("deck.pptx", "pptx", "Launch plan"),
    ],
)
def test_office_to_pdf(tmp_path, job_dirs, name, kind, expected):
    need("soffice")
    [output] = office_to_pdf.run([fixture_input(tmp_path, name, kind)], NoOptions(), job_dirs)
    assert output.name == output_name(name, "pdf")
    assert expected in pdf_text(output)


def test_office_to_pdf_reports_unreadable_files(tmp_path, job_dirs):
    need("soffice")
    broken = tmp_path / "broken"
    broken.write_bytes(b"PK\x03\x04 not really a document")
    with pytest.raises(OpError, match="couldn't be converted"):
        office_to_pdf.run([InputPath(broken, "broken.docx", "docx")], NoOptions(), job_dirs)


def test_compress_pdf(tmp_path, job_dirs):
    need("gs", "qpdf")
    item = fixture_input(tmp_path, "report.pdf", "pdf")
    options = compress_pdf.CompressOptions(level="small")
    [output] = compress_pdf.run([item], options, job_dirs)
    assert output.name == "report-compressed.pdf"
    assert output.stat().st_size <= item.path.stat().st_size
    assert "Quarterly report" in pdf_text(output)


def test_pdf_ops_explain_locked_and_damaged_files(tmp_path, job_dirs):
    need("qpdf")
    locked = tmp_path / "locked"
    subprocess.run(
        ["qpdf", "--encrypt", "secret", "secret", "256", "--", FIXTURES / "report.pdf", locked],
        check=True,
    )
    damaged = tmp_path / "damaged"
    damaged.write_bytes(b"%PDF-1.7\nnothing useful here")
    for op in (compress_pdf, pdf_to_word, pdf_to_excel, pdf_to_powerpoint):
        options = op.OP.options()
        with pytest.raises(OpError, match="password-protected"):
            op.run([InputPath(locked, "locked.pdf", "pdf")], options, job_dirs)
        with pytest.raises(OpError, match="couldn't be read"):
            op.run([InputPath(damaged, "damaged.pdf", "pdf")], options, job_dirs)


def test_pdf_to_word(tmp_path, job_dirs):
    need("soffice")
    [output] = pdf_to_word.run(
        [fixture_input(tmp_path, "report.pdf", "pdf")], NoOptions(), job_dirs
    )
    assert output.name == "report.docx"
    with zipfile.ZipFile(output) as docx:
        assert "Quarterly report" in docx.read("word/document.xml").decode()


def test_pdf_to_excel_extracts_tables_with_numbers(tmp_path, job_dirs):
    [output] = pdf_to_excel.run(
        [fixture_input(tmp_path, "report.pdf", "pdf")], NoOptions(), job_dirs
    )
    sheet = load_workbook(output)["Page 1"]
    rows = [[cell.value for cell in row] for row in sheet.iter_rows()]
    assert ["Region", "Units", "Revenue"] in rows
    assert ["North", 1200, 15000.5] in rows


def test_cell_values():
    assert pdf_to_excel.cell_value(" 1,234.50 ") == 1234.5
    assert pdf_to_excel.cell_value("-42") == -42
    assert pdf_to_excel.cell_value("12,34") == "12,34"
    assert pdf_to_excel.cell_value("") is None
    assert pdf_to_excel.cell_value(None) is None


def test_pdf_to_powerpoint(tmp_path, job_dirs):
    [output] = pdf_to_powerpoint.run(
        [fixture_input(tmp_path, "report.pdf", "pdf")], NoOptions(), job_dirs
    )
    deck = Presentation(output)
    assert len(deck.slides) == 1
    [picture] = deck.slides[0].shapes
    assert picture.shape_type == 13  # MSO_SHAPE_TYPE.PICTURE
    # A4 portrait keeps its shape.
    assert deck.slide_height / deck.slide_width == pytest.approx(842 / 595, rel=0.01)


def test_slide_sizes_stay_within_powerpoint_limits():
    tiny = pdf_to_powerpoint.slide_size(36, 18)
    assert tiny == (pdf_to_powerpoint.MIN_SIDE * 2, pdf_to_powerpoint.MIN_SIDE)
    huge = pdf_to_powerpoint.slide_size(10_000, 5_000)
    assert huge == (pdf_to_powerpoint.MAX_SIDE, pdf_to_powerpoint.MAX_SIDE // 2)
    # A strip too long for both limits keeps the maximum.
    strip_width, strip_height = pdf_to_powerpoint.slide_size(10_000, 100)
    assert strip_width == pdf_to_powerpoint.MAX_SIDE
    assert strip_height < pdf_to_powerpoint.MIN_SIDE


@pytest.fixture
def chromium(monkeypatch):
    path = os.environ.get("FREEREC_CHROMIUM_PATH") or shutil.which("chromium")
    if path:
        monkeypatch.setenv("FREEREC_CHROMIUM_PATH", path)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_html_to_pdf_blocks_scripts_network_and_local_files(tmp_path, job_dirs, chromium):
    item = fixture_input(tmp_path, "page.html", "html", "invoice.html")
    try:
        [output] = html_to_pdf.run([item], html_to_pdf.HtmlOptions(page_size="letter"), job_dirs)
    except OpError:
        need("chromium")
        raise
    assert output.name == "invoice.pdf"
    text = pdf_text(output)
    assert "Invoice 1042" in text
    assert "SCRIPT RAN" not in text
    hostname = Path("/etc/hostname").read_text().strip()
    if hostname:
        assert hostname not in text
    width, height = pdfium.PdfDocument(output)[0].get_size()
    assert (round(width), round(height)) == (612, 792)


@pytest.mark.parametrize("target", ["mobi", "azw3", "pdf"])
def test_ebook_converter(tmp_path, job_dirs, target):
    need("ebook-convert")
    options = ebook_convert.EbookOptions(output=target)
    [output] = ebook_convert.run([fixture_input(tmp_path, "book.epub", "epub")], options, job_dirs)
    assert output.name == f"book.{target}"
    if target == "pdf":
        assert "Quarterly report" in pdf_text(output)
    else:
        assert output.read_bytes()[60:68] == b"BOOKMOBI"


def test_ebook_converter_refuses_same_format(tmp_path, job_dirs):
    item = fixture_input(tmp_path, "book.epub", "epub")
    with pytest.raises(OpError, match="already EPUB"):
        ebook_convert.run([item], ebook_convert.EbookOptions(output="epub"), job_dirs)


def test_output_names_are_safe():
    assert output_name("Q3 report.final.docx", "pdf") == "Q3 report.final.pdf"
    assert output_name("../../etc/passwd", "pdf") == "passwd.pdf"
    assert output_name("a/b\\c:d*e.pdf", "pdf", "-compressed") == "b_c_d_e-compressed.pdf"
    assert output_name("...", "pdf") == "document.pdf"
    assert output_name("Résumé.pdf", "docx") == "Résumé.docx"
