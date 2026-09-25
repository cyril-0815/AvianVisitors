"""Pytest entry point for the strict-CSP checks (index.html, boot.js).

The work itself lives in a node suite, next to the frontend code it
checks. This module is what makes `pytest` - and therefore CI - run it.
"""

import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(shutil.which("node") is None, reason="node is unavailable")
def test_the_page_runs_under_a_strict_csp():
    suite = Path(__file__).with_name("test_csp.js")
    subprocess.run(["node", str(suite)], check=True)
