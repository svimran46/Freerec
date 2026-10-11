"""Server-side operations, one module per tool. Register new ops in `_all_ops`."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel

from freerec.config import Settings


class OpError(Exception):
    """A failure whose message is safe and useful to show the user."""


class NoOptions(BaseModel):
    model_config = {"extra": "forbid"}


@dataclass(frozen=True)
class InputPath:
    path: Path
    name: str
    kind: str


@dataclass(frozen=True)
class Op:
    slug: str
    accepts: frozenset[str]
    run: Callable[[list[InputPath], BaseModel, Path], list[Path]]
    """Reads the inputs, writes outputs into the given directory and returns their paths."""
    options: type[BaseModel] = NoOptions
    max_files: int = 1
    debug_only: bool = False


def _all_ops() -> list[Op]:
    # Ops import their conversion libraries (the "docs" extra) only when they run, so
    # the API can validate every tool's options without them; only the worker has them.
    from freerec.ops import (
        compress_pdf,
        ebook_convert,
        echo,
        html_to_pdf,
        office_to_pdf,
        pdf_to_excel,
        pdf_to_powerpoint,
        pdf_to_word,
    )

    return [
        echo.OP,
        compress_pdf.OP,
        office_to_pdf.OP,
        pdf_to_word.OP,
        pdf_to_excel.OP,
        pdf_to_powerpoint.OP,
        html_to_pdf.OP,
        ebook_convert.OP,
    ]


def enabled_ops(settings: Settings) -> dict[str, Op]:
    return {op.slug: op for op in _all_ops() if settings.enable_debug_ops or not op.debug_only}
