"""Runs LibreOffice headless with a throwaway, locked-down profile per job."""

from pathlib import Path

from freerec.ops import OpError
from freerec.ops._tools import run_tool

# Untrusted documents must not run macros or pull in linked files and URLs, which
# could leak server files or reach internal hosts.
_HARDENED_PROFILE = """<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry"
           xmlns:xs="http://www.w3.org/2001/XMLSchema"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <item oor:path="/org.openoffice.Office.Common/Security/Scripting">
    <prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop>
  </item>
  <item oor:path="/org.openoffice.Office.Common/Security/Scripting">
    <prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop>
  </item>
  <item oor:path="/org.openoffice.Office.Common/Security/Scripting">
    <prop oor:name="BlockUntrustedRefererLinks" oor:op="fuse"><value>true</value></prop>
  </item>
  <item oor:path="/org.openoffice.Office.Writer/Content/Update">
    <prop oor:name="Link" oor:op="fuse"><value>2</value></prop>
  </item>
  <item oor:path="/org.openoffice.Office.Calc/Content/Update">
    <prop oor:name="Link" oor:op="fuse"><value>1</value></prop>
  </item>
</oor:items>
"""


def convert(
    source: Path, target_filter: str, work: Path, *, failure: str, infilter: str | None = None
) -> Path:
    """Converts `source` with a LibreOffice export filter such as "pdf" or
    "docx:MS Word 2007 XML". Returns the converted file in `work/out`."""
    profile = work / "profile"
    (profile / "user").mkdir(parents=True)
    (profile / "user" / "registrymodifications.xcu").write_text(_HARDENED_PROFILE)
    out = work / "out"
    out.mkdir()
    args = [
        "soffice",
        f"-env:UserInstallation={profile.as_uri()}",
        "--headless",
        "--norestore",
        "--nologo",
        "--nodefault",
        "--nolockcheck",
    ]
    if infilter:
        args.append(f"--infilter={infilter}")
    args += ["--convert-to", target_filter, "--outdir", out, source]
    run_tool(args, home=work, failure=failure)
    extension = target_filter.split(":", 1)[0]
    converted = out / f"{source.stem}.{extension}"
    if not converted.is_file() or converted.stat().st_size == 0:
        # LibreOffice exits 0 even when it can't load the file.
        raise OpError(failure)
    return converted
