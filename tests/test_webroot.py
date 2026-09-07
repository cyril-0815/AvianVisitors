"""Pytest entry point for the webroot manifest check.

A frontend file only reaches the browser if link_webroot.sh publishes it.
The node suite compares that manifest against what index.html loads.
"""

import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(shutil.which("node") is None, reason="node is unavailable")
def test_every_asset_index_html_loads_is_published():
    suite = Path(__file__).with_name("test_webroot_manifest.js")
    subprocess.run(["node", str(suite)], check=True)
