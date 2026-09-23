"""Pytest entry point for the read-only copy (modus.json, stand line).

The work itself lives in a node suite, next to the frontend code it
checks. This module is what makes `pytest` - and therefore CI - run it.
"""

import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(shutil.which("node") is None, reason="node is unavailable")
def test_the_read_only_copy_and_its_stand_line():
    suite = Path(__file__).with_name("test_read_only.js")
    subprocess.run(["node", str(suite)], check=True)
