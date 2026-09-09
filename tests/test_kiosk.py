"""Pytest entry point for the kiosk display's URL parameters.

The work itself lives in a node suite, next to the frontend code it
checks. This module is what makes `pytest` - and therefore CI - run it.
"""

import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(shutil.which("node") is None, reason="node is unavailable")
def test_the_automatic_time_window_and_its_brake():
    suite = Path(__file__).with_name("test_auto_window.js")
    subprocess.run(["node", str(suite)], check=True)
