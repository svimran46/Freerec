"""PDF to an editable Word document, via LibreOffice's PDF import.

PyMuPDF-based converters give closer layouts but are AGPL; see docs/PLAN.md.
"""

import shutil
from pathlib import Path

from pydantic import BaseModel

from freerec.ops import InputPath, NoOptions, Op
from freerec.ops._pdf import check_pdf
from freerec.ops._tools import output_name, scratch_dir, staged_input
from freerec.ops.libreoffice import convert


def run(inputs: list[InputPath], _options: BaseModel, out_dir: Path) -> list[Path]:
    [item] = inputs
    check_pdf(item)
    work = scratch_dir(out_dir)
    converted = convert(
        staged_input(item, work),
        "docx:MS Word 2007 XML",
        work,
        infilter="writer_pdf_import",
        failure=f"{item.name} couldn't be converted. It may be damaged.",
    )
    target = out_dir / output_name(item.name, "docx")
    shutil.move(converted, target)
    return [target]


OP = Op(slug="pdf-to-word", accepts=frozenset({"pdf"}), run=run, options=NoOptions)
