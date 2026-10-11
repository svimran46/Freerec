"""Makes PDFs smaller with Ghostscript, then linearizes them with qpdf for fast web viewing.

Ghostscript (AGPL) runs unmodified as a separate program.
"""

import shutil
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from freerec.ops import InputPath, Op
from freerec.ops._pdf import check_pdf
from freerec.ops._tools import output_name, require_output, run_tool, scratch_dir

# Ghostscript presets: image resolution of about 300, 150, and 72 DPI.
PRESETS = {"high": "/printer", "balanced": "/ebook", "small": "/screen"}


class CompressOptions(BaseModel):
    model_config = {"extra": "forbid"}
    level: Literal["high", "balanced", "small"] = "balanced"


def run(inputs: list[InputPath], options: BaseModel, out_dir: Path) -> list[Path]:
    assert isinstance(options, CompressOptions)
    [item] = inputs
    check_pdf(item)
    work = scratch_dir(out_dir)
    failure = f"{item.name} couldn't be compressed. It may be damaged."
    squeezed = work / "squeezed.pdf"
    run_tool(
        [
            "gs",
            "-dSAFER",
            "-dBATCH",
            "-dNOPAUSE",
            "-dQUIET",
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.7",
            f"-dPDFSETTINGS={PRESETS[options.level]}",
            "-dDetectDuplicateImages=true",
            "-dCompressFonts=true",
            f"-sOutputFile={squeezed}",
            item.path,
        ],
        home=work,
        failure=failure,
    )
    linearized = work / "linearized.pdf"
    run_tool(
        ["qpdf", "--linearize", "--object-streams=generate", squeezed, linearized],
        home=work,
        failure=failure,
    )
    require_output(linearized, failure)

    target = out_dir / output_name(item.name, "pdf", "-compressed")
    # Already-optimized files can come out larger; then the original is the better result.
    best = linearized if linearized.stat().st_size < item.path.stat().st_size else item.path
    shutil.copyfile(best, target)
    return [target]


OP = Op(slug="compress-pdf", accepts=frozenset({"pdf"}), run=run, options=CompressOptions)
