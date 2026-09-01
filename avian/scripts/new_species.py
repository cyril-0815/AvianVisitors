#!/usr/bin/env python3
"""
new_species.py - Batch-Werkzeug fuer AvianVisitors

Automatisiert den kompletten Ablauf fuer eine oder mehrere neue Vogelarten:
  1) pregen.py       - Illustrationen via Gemini generieren (sitzend + fliegend)
  2) cutout.py        - Hintergrund entfernen / freistellen
  3) build_masks.py   - dims.json + masks.json neu bauen
  4) apt.js            - SKETCH_VERSION und IMG_VERSION automatisch hochzaehlen

Voraussetzung: GEMINI_API_KEY muss in dieser Shell bereits gesetzt sein
(z.B. mit  set GEMINI_API_KEY=dein-key  in cmd.exe), genau wie beim manuellen
Ablauf zuvor. Dieses Skript setzt/speichert den Key nirgends selbst.

Aufruf-Varianten:

  1) Direkt auf der Kommandozeile, eine oder mehrere Arten:
     python new_species.py "Sitta europaea|Eurasian Nuthatch" "Turdus merula|Eurasian Blackbird"

  2) Aus einer Textdatei (eine Art pro Zeile, Format "Wissenschaftlich|Englisch",
     leere Zeilen und Zeilen mit # werden ignoriert):
     python new_species.py --file species.txt

  3) Vorhandene Bilder trotzdem neu generieren (statt vorhandene zu ueberspringen):
     python new_species.py --force "Sitta europaea|Eurasian Nuthatch"

Nach dem Lauf zeigt das Skript dir die scp-Befehle an, mit denen du die
geaenderten Dateien auf den Pi kopierst (mit --deploy macht es das gleich
selbst, ruft dazu einfach scp.exe auf - Passwort wird wie gewohnt pro Datei
abgefragt).
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = SCRIPT_DIR.parent / "frontend"
ILLUSTRATIONS_DIR = SCRIPT_DIR.parent / "assets" / "illustrations"
APT_JS = FRONTEND_DIR / "apt.js"

# --- Anpassen falls sich Pi-Adresse/Nutzer/Pfad je aendern ---
PI_HOST = "vogelbesuch.local"
PI_USER = "michelc"
PI_BASE = "~/BirdNET-Pi/avian"


def slugify(sci_name):
    s = sci_name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def parse_species_arg(raw):
    if "|" not in raw:
        raise ValueError(f"Ungueltiges Format (erwartet 'Sci|Common'): {raw!r}")
    sci, com = raw.split("|", 1)
    sci, com = sci.strip(), com.strip()
    if not sci or not com:
        raise ValueError(f"Ungueltiges Format (erwartet 'Sci|Common'): {raw!r}")
    return sci, com


def load_species_file(path):
    species = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        species.append(parse_species_arg(line))
    return species


def run(cmd, **kwargs):
    # PYTHONUTF8=1 erzwingen, sonst stolpert Python unter Windows beim Lesen
    # der UTF-8 Prompt-Datei ueber die cp1252-Standardkodierung.
    env = dict(os.environ)
    env["PYTHONUTF8"] = "1"
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=SCRIPT_DIR, env=env, **kwargs)


def pregen_species(sci, com, force):
    cmd = [sys.executable, "pregen.py", "--species", f"{sci}|{com}"]
    if force:
        cmd.append("--force")
    result = run(cmd)
    return result.returncode == 0


def cutout_species(slug):
    result = run([sys.executable, "cutout.py", slug])
    return result.returncode == 0


def build_masks():
    result = run([sys.executable, "build_masks.py"])
    return result.returncode == 0


def bump_apt_js(species_done):
    text = APT_JS.read_text(encoding="utf-8")

    m = re.search(r"var SKETCH_VERSION = 'r(\d+)'", text)
    if not m:
        print("  [warn] SKETCH_VERSION nicht gefunden, ueberspringe Versions-Bump.")
        return None
    current = int(m.group(1))
    new = current + 1
    names = ", ".join(com for _, com in species_done)
    note = f"r{new}: added {names} via new_species.py"

    text = re.sub(
        r"var SKETCH_VERSION = 'r\d+'; //[^\n]*",
        f"var SKETCH_VERSION = 'r{new}'; // {note}",
        text,
        count=1,
    )
    text = re.sub(
        r"var IMG_VERSION = 'r\d+'; //[^\n]*",
        f"var IMG_VERSION = 'r{new}'; // {note}",
        text,
        count=1,
    )
    APT_JS.write_text(text, encoding="utf-8")
    return new


def deploy(files):
    # Gruppiert nach Ziel-Verzeichnis, damit scp mehrere Dateien in einem
    # Rutsch hochlaedt (ein Passwort-Prompt pro Verzeichnis statt pro Datei).
    groups = {}
    for local_path, remote_path in files:
        remote_dir = remote_path.rsplit("/", 1)[0]
        groups.setdefault(remote_dir, []).append(local_path)

    for remote_dir, local_paths in groups.items():
        dest = f"{PI_USER}@{PI_HOST}:{remote_dir}/"
        cmd = ["scp"] + [str(p) for p in local_paths] + [dest]
        print(f"  $ scp {' '.join(str(p) for p in local_paths)} {dest}")
        subprocess.run(cmd, check=False)


def main():
    parser = argparse.ArgumentParser(description="Neue AvianVisitors-Arten in einem Rutsch generieren.")
    parser.add_argument("species", nargs="*", help="Eine oder mehrere 'Wissenschaftlich|Englisch' Eintraege")
    parser.add_argument("--file", help="Textdatei mit einer Art pro Zeile (Format 'Wissenschaftlich|Englisch')")
    parser.add_argument("--force", action="store_true", help="Auch bereits vorhandene Bilder neu generieren")
    parser.add_argument("--deploy", action="store_true", help="Geaenderte Dateien am Schluss automatisch per scp auf den Pi kopieren")
    args = parser.parse_args()

    species_list = []
    for raw in args.species:
        species_list.append(parse_species_arg(raw))
    if args.file:
        species_list.extend(load_species_file(args.file))

    if not species_list:
        parser.error("Keine Arten angegeben. Entweder als Argumente oder mit --file.")

    print(f"Verarbeite {len(species_list)} Art(en): " + ", ".join(c for _, c in species_list))
    print()

    done = []
    failed = []

    print("=== Schritt 1/3: Illustrationen generieren (pregen.py) ===")
    for sci, com in species_list:
        print(f"- {com} ({sci})")
        ok = pregen_species(sci, com, args.force)
        if ok:
            done.append((sci, com))
        else:
            print(f"  [FEHLER] Generierung fuer {com} fehlgeschlagen, wird uebersprungen.")
            failed.append(com)
    print()

    if not done:
        print("Keine Art erfolgreich generiert, breche ab.")
        sys.exit(1)

    print("=== Schritt 2/3: Freistellen (cutout.py) ===")
    for sci, com in done:
        slug = slugify(sci)
        print(f"- {com} -> {slug}")
        cutout_species(slug)
    print()

    print("=== Schritt 3/3: Masken + Versionen aktualisieren ===")
    build_masks()
    new_version = bump_apt_js(done)
    if new_version:
        print(f"  apt.js: SKETCH_VERSION/IMG_VERSION -> r{new_version}")
    print()

    print("=== Fertig ===")
    print(f"Erfolgreich: {len(done)} ({', '.join(c for _, c in done)})")
    if failed:
        print(f"Fehlgeschlagen: {len(failed)} ({', '.join(failed)}) - kannst du einfach nochmal einzeln aufrufen.")
    print()

    files_to_deploy = [
        (APT_JS, f"{PI_BASE}/frontend/apt.js"),
        (FRONTEND_DIR / "dims.json", f"{PI_BASE}/frontend/dims.json"),
        (FRONTEND_DIR / "masks.json", f"{PI_BASE}/frontend/masks.json"),
    ]
    for sci, com in done:
        slug = slugify(sci)
        for suffix in ("", "-2"):
            png = ILLUSTRATIONS_DIR / f"{slug}{suffix}.png"
            if png.exists():
                files_to_deploy.append((png, f"{PI_BASE}/assets/illustrations/{png.name}"))

    if args.deploy:
        print("=== Deploy auf den Pi ===")
        deploy(files_to_deploy)
    else:
        print("Zum Kopieren auf den Pi, entweder 'python new_species.py ... --deploy' beim naechsten Mal nutzen,")
        print("oder von Hand:")
        for local_path, remote_path in files_to_deploy:
            print(f'  scp "{local_path}" {PI_USER}@{PI_HOST}:{remote_path}')


if __name__ == "__main__":
    main()
