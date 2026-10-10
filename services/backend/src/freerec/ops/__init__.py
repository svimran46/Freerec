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
    from freerec.ops import echo

    return [echo.OP]


def enabled_ops(settings: Settings) -> dict[str, Op]:
    return {op.slug: op for op in _all_ops() if settings.enable_debug_ops or not op.debug_only}
