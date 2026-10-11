"""Converts between EPUB, MOBI, AZW3, and PDF with Calibre's ebook-convert.

Calibre (GPL) runs unmodified as a separate program.
"""

import shutil
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from freerec.ops import InputPath, Op, OpError
from freerec.ops._tools import output_name, require_output, run_tool, scratch_dir, staged_input


class EbookOptions(BaseModel):
    model_config = {"extra": "forbid"}
    output: Literal["epub", "mobi", "azw3", "pdf"] = "epub"


def run(inputs: list[InputPath], options: BaseModel, out_dir: Path) -> list[Path]:
    assert isinstance(options, EbookOptions)
    [item] = inputs
    if item.kind == options.output:
        raise OpError(f"{item.name} is already {options.output.upper()}. Choose another format.")
    work = scratch_dir(out_dir)
    source = staged_input(item, work)
    converted = work / f"output.{options.output}"
    run_tool(
        ["ebook-convert", source, converted],
        home=work,
        # Calibre renders with Qt WebEngine, which needs no display in offscreen mode.
        env={"QT_QPA_PLATFORM": "offscreen", "QTWEBENGINE_CHROMIUM_FLAGS": "--no-sandbox"},
        failure=f"{item.name} couldn't be converted. It may be damaged or DRM-protected.",
    )
    require_output(converted, f"{item.name} couldn't be converted.")
    target = out_dir / output_name(item.name, options.output)
    shutil.move(converted, target)
    return [target]


OP = Op(
    slug="ebook-converter",
    accepts=frozenset({"epub", "mobi", "azw3", "pdf"}),
    run=run,
    options=EbookOptions,
)
