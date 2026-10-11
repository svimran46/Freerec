"""Word, Excel, PowerPoint, OpenDocument, RTF, and text files to PDF, via LibreOffice."""

import shutil
from pathlib import Path

from pydantic import BaseModel

from freerec.ops import InputPath, NoOptions, Op
from freerec.ops._tools import output_name, scratch_dir, staged_input
from freerec.ops.libreoffice import convert

ACCEPTS = frozenset(
    {"docx", "xlsx", "pptx", "doc", "xls", "ppt", "odt", "ods", "odp", "rtf", "txt"}
)


def run(inputs: list[InputPath], _options: BaseModel, out_dir: Path) -> list[Path]:
    [item] = inputs
    work = scratch_dir(out_dir)
    converted = convert(
        staged_input(item, work),
        "pdf",
        work,
        failure=f"{item.name} couldn't be converted. It may be damaged or password-protected.",
    )
    target = out_dir / output_name(item.name, "pdf")
    shutil.move(converted, target)
    return [target]


OP = Op(slug="office-to-pdf", accepts=ACCEPTS, run=run, options=NoOptions)
