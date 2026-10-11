"""Prints an HTML file to PDF with headless Chromium.

The page is loaded with set_content (an about:blank origin, which may not load
file:// URLs), with JavaScript off and every network request blocked, so an
uploaded page can't read server files or reach other hosts. Images must be
embedded as data: URLs.
"""

import tempfile
from pathlib import Path
from typing import Literal

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright
from pydantic import BaseModel

from freerec.config import get_settings
from freerec.ops import InputPath, Op, OpError
from freerec.ops._tools import output_name, require_output, tool_env

MARGINS = {"none": "0", "small": "10mm", "normal": "20mm"}


class HtmlOptions(BaseModel):
    model_config = {"extra": "forbid"}
    page_size: Literal["a4", "letter"] = "a4"
    landscape: bool = False
    margin: Literal["none", "small", "normal"] = "normal"


def read_html(path: Path) -> str:
    raw = path.read_bytes()
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")


def run(inputs: list[InputPath], options: BaseModel, out_dir: Path) -> list[Path]:
    assert isinstance(options, HtmlOptions)
    [item] = inputs
    settings = get_settings()
    target = out_dir / output_name(item.name, "pdf")
    timeout_ms = settings.tool_timeout_seconds * 1000
    try:
        # Chromium creates Unix sockets in its temp directory, and their paths must
        # stay under 108 characters, so it gets a short home of its own.
        with (
            tempfile.TemporaryDirectory(prefix="chromium-") as home,
            sync_playwright() as playwright,
        ):
            browser = playwright.chromium.launch(
                executable_path=settings.chromium_path,
                env=tool_env(Path(home)),
                args=["--disable-gpu", "--disable-dev-shm-usage"],
                timeout=timeout_ms,
            )
            try:
                context = browser.new_context(java_script_enabled=False, offline=True)
                context.route("**/*", lambda route: route.abort())
                page = context.new_page()
                page.set_content(read_html(item.path), wait_until="load", timeout=timeout_ms)
                margin = MARGINS[options.margin]
                page.pdf(
                    path=target,
                    format="A4" if options.page_size == "a4" else "Letter",
                    landscape=options.landscape,
                    margin={"top": margin, "right": margin, "bottom": margin, "left": margin},
                    print_background=True,
                )
            finally:
                browser.close()
    except PlaywrightError as error:
        raise OpError(f"{item.name} couldn't be printed to PDF.") from error
    return [require_output(target, f"{item.name} couldn't be printed to PDF.")]


OP = Op(slug="html-to-pdf", accepts=frozenset({"html"}), run=run, options=HtmlOptions)
