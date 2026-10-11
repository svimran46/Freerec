"""Helpers for ops that run external programs on untrusted files."""

import logging
import os
import re
import shutil
import subprocess
import tempfile
from collections.abc import Sequence
from pathlib import Path

from freerec.config import get_settings
from freerec.kinds import EXTENSIONS
from freerec.ops import InputPath, OpError

log = logging.getLogger(__name__)


def scratch_dir(out_dir: Path) -> Path:
    """A private working directory next to the job's output directory; removed with the job."""
    return Path(tempfile.mkdtemp(prefix="work-", dir=out_dir.parent))


def tool_env(home: Path, extra: dict[str, str] | None = None) -> dict[str, str]:
    """A minimal environment, so converters never see the worker's credentials."""
    env = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": str(home),
        "TMPDIR": str(home),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
    }
    env.update(extra or {})
    return env


def run_tool(
    args: Sequence[str | Path],
    *,
    home: Path,
    failure: str,
    env: dict[str, str] | None = None,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[bytes]:
    """Runs a converter with a timeout and a scrubbed environment.

    `failure` is the message users see if the program fails; its own output is
    only logged, because it can mention server paths.
    """
    timeout = get_settings().tool_timeout_seconds
    try:
        result = subprocess.run(
            [str(arg) for arg in args],
            cwd=cwd or home,
            env=tool_env(home, env),
            stdin=subprocess.DEVNULL,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise OpError("Processing took too long. Try a smaller file.") from error
    except FileNotFoundError as error:
        log.error("converter not installed: %s", args[0])
        raise OpError("This tool is temporarily unavailable.") from error
    if result.returncode != 0:
        log.warning(
            "%s exited with %s: %s",
            Path(str(args[0])).name,
            result.returncode,
            result.stderr[-2000:].decode(errors="replace"),
        )
        raise OpError(failure)
    return result


def staged_input(item: InputPath, work: Path) -> Path:
    """Copies an input to a name with the right extension; converters rely on it."""
    target = work / f"input{EXTENSIONS[item.kind][0]}"
    shutil.copyfile(item.path, target)
    return target


_UNSAFE = re.compile(r"[^\w\-. ()]+")


def output_name(original: str, extension: str, suffix: str = "") -> str:
    """A safe output file name based on the input's: "Q3 report.docx" → "Q3 report.pdf"."""
    stem = _UNSAFE.sub("_", Path(original).stem).strip(" ._") or "document"
    return f"{stem[:100]}{suffix}.{extension}"


def require_output(path: Path, failure: str) -> Path:
    if not path.is_file() or path.stat().st_size == 0:
        raise OpError(failure)
    return path
