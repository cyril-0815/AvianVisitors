"""Pytest entry points for the public UI translation (en / de / fr).

The work itself lives in a node suite and a php suite, matching the
languages the code under test is written in. This module is what makes
`pytest` - and therefore CI - run them.
"""

import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(shutil.which("node") is None, reason="node is unavailable")
def test_translation_tables_are_complete_and_consistent():
    suite = Path(__file__).with_name("test_i18n_dictionaries.js")
    subprocess.run(["node", str(suite)], check=True)


@pytest.mark.skipif(shutil.which("node") is None, reason="node is unavailable")
def test_translation_covers_the_public_ui():
    suite = Path(__file__).with_name("test_i18n_coverage.js")
    subprocess.run(["node", str(suite)], check=True)


@pytest.mark.skipif(shutil.which("php") is None, reason="php is unavailable")
def test_species_names_resolve_from_the_scientific_name():
    suite = Path(__file__).with_name("test_species_name_i18n.php")
    subprocess.run(["php", str(suite)], check=True)
