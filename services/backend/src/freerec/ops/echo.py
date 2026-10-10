"""Copies inputs to outputs. Exercises the whole job pipeline without real processing."""

import shutil
from pathlib import Path

from pydantic import BaseModel

from freerec.kinds import EXTENSIONS
from freerec.ops import InputPath, NoOptions, Op


def run(inputs: list[InputPath], _options: BaseModel, out_dir: Path) -> list[Path]:
    outputs = []
    for i, item in enumerate(inputs):
        target = out_dir / f"echo-{i + 1}{EXTENSIONS[item.kind][0]}"
        shutil.copyfile(item.path, target)
        outputs.append(target)
    return outputs


OP = Op(
    slug="echo",
    accepts=frozenset(EXTENSIONS),
    run=run,
    options=NoOptions,
    max_files=5,
    debug_only=True,
)
