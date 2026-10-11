"""Shared checks for ops that read PDFs."""

import pypdfium2 as pdfium

from freerec.ops import InputPath, OpError

MAX_PAGES = 500


def open_pdf(item: InputPath) -> pdfium.PdfDocument:
    """Opens a PDF, turning library errors into messages for the user."""
    try:
        doc = pdfium.PdfDocument(item.path)
    except pdfium.PdfiumError as error:
        if "password" in str(error).lower():
            raise OpError(
                f"{item.name} is password-protected. Remove the password first."
            ) from error
        raise OpError(f"{item.name} couldn't be read. It may be damaged.") from error
    if len(doc) > MAX_PAGES:
        count = len(doc)
        doc.close()
        raise OpError(f"{item.name} has {count} pages. The limit is {MAX_PAGES}.")
    return doc


def check_pdf(item: InputPath) -> int:
    """Fails early on unreadable, locked, or oversized PDFs. Returns the page count."""
    doc = open_pdf(item)
    try:
        return len(doc)
    finally:
        doc.close()
