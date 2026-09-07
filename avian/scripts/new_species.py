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

WICHTIG - Isolation von anderer, gleichzeitig laufender Arbeit:
  Das Skript arbeitet NIE im normalen Arbeitsordner (dort, wo du z.B. gerade
  von Hand an apt.js herumbastelst). Stattdessen legt es sich bei jedem Lauf
  ein eigenes, komplett separates Git-Worktree an (ein zweiter Ordner neben
  dem Hauptordner, gleiche .git-Historie, eigener frischer Branch ab dem
  aktuellen Stand). Alle Schritte - Bildgenerierung, Freistellen, Masken,
  Versions-Bump, Commit - passieren nur dort drin. Dein Hauptordner und
  jede darin offene, unfertige Änderung bleiben dabei zu jedem Zeitpunkt
  unberuehrt, du kannst also parallel weiterarbeiten.

Deploy in den Fork (--deploy):
  Pusht den frischen Branch aus dem Worktree in deinen Fork, merged ihn
  danach automatisch in den Hauptbranch (Standard: avian-visitors, mit
  --main-branch aenderbar) und pusht auch den Hauptbranch. Das passiert in
  einem eigenen, zweiten Worktree - dein normaler Arbeitsordner wird dabei
  nie beruehrt, auch nicht kurz umgeschaltet. Gibt es beim Merge einen
  Konflikt (z.B. weil parallel jemand anders am gleichen Stueck Code
  gearbeitet hat), bricht das Skript den Merge sauber ab: der Feature-
  Branch bleibt trotzdem gepusht in deinem Fork, du loest den Konflikt dann
  von Hand (z.B. per Pull Request auf GitHub). Ohne --deploy bleibt alles
  beim alten Stand, Worktree(s) bleiben bestehen, der Pfad wird ausgegeben.

  Es gibt weiterhin KEINE automatische Verbindung zum Pi - das `git pull`
  dort machst du bewusst von Hand, nachdem der Hauptbranch aktualisiert ist.
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

MAIN_SCRIPT_DIR = Path(__file__).resolve().parent
MAIN_REPO_ROOT = MAIN_SCRIPT_DIR.parent.parent
# Bewusst ausserhalb von OneDrive (ausserhalb von MAIN_REPO_ROOT), im System-
# Temp-Ordner: dein Hauptordner liegt unter OneDrive-Sync, und Git-Operationen
# dort koennen haengen bleiben, weil OneDrive Dateien im .git-Ordner sperrt
# (bereits einmal aufgetreten). Ausserhalb von OneDrive passiert das nicht.
WORKTREES_PARENT = Path(tempfile.gettempdir()) / f"{MAIN_REPO_ROOT.name}-worktrees"
DEFAULT_MAIN_BRANCH = "avian-visitors"


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


def run(cmd, cwd, **kwargs):
    # PYTHONUTF8=1 erzwingen, sonst stolpert Python unter Windows beim Lesen
    # der UTF-8 Prompt-Datei ueber die cp1252-Standardkodierung.
    env = dict(os.environ)
    env["PYTHONUTF8"] = "1"
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    return subprocess.run(cmd, cwd=cwd, env=env, **kwargs)


def make_branch_name(species_done):
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    hint = slugify(species_done[0][0])[:24] if len(species_done) == 1 else f"{len(species_done)}-species"
    return f"new-species/{stamp}-{hint}"


def create_worktree(branch):
    WORKTREES_PARENT.mkdir(parents=True, exist_ok=True)
    worktree_path = WORKTREES_PARENT / branch.replace("/", "-")

    result = run(
        ["git", "worktree", "add", "-b", branch, str(worktree_path), "HEAD"],
        cwd=MAIN_REPO_ROOT,
    )
    if result.returncode != 0:
        return None
    return worktree_path


def remove_worktree(worktree_path):
    run(["git", "worktree", "remove", "--force", str(worktree_path)], cwd=MAIN_REPO_ROOT)
    # Falls davon trotzdem noch ein leerer Ordner uebrig bleibt, aufraeumen.
    if worktree_path.exists():
        shutil.rmtree(worktree_path, ignore_errors=True)


def pregen_species(scripts_dir, sci, com, force):
    cmd = [sys.executable, "pregen.py", "--species", f"{sci}|{com}"]
    if force:
        cmd.append("--force")
    result = run(cmd, cwd=scripts_dir)
    return result.returncode == 0


def cutout_species(scripts_dir, slug):
    result = run([sys.executable, "cutout.py", slug], cwd=scripts_dir)
    return result.returncode == 0


def build_masks(scripts_dir):
    result = run([sys.executable, "build_masks.py"], cwd=scripts_dir)
    return result.returncode == 0


def bump_apt_js(apt_js_path, species_done):
    text = apt_js_path.read_text(encoding="utf-8")

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
    apt_js_path.write_text(text, encoding="utf-8")
    return new


def commit_and_push(worktree_path, branch, paths_to_commit, species_done):
    names = ", ".join(com for _, com in species_done)
    abs_paths = [str(p) for p in paths_to_commit if p.exists()]
    if not abs_paths:
        print("  Nichts zu committen.")
        return False

    run(["git", "add"] + abs_paths, cwd=worktree_path)
    commit = run(["git", "commit", "-m", f"Add illustrations: {names}"], cwd=worktree_path)
    if commit.returncode != 0:
        print("  [warn] Nichts zu committen oder Commit fehlgeschlagen.")
        return False

    push = run(["git", "push", "-u", "origin", branch], cwd=worktree_path)
    if push.returncode != 0:
        print("  [FEHLER] git push fehlgeschlagen.")
        return False

    print(f"  Push erfolgreich auf eigenem Branch '{branch}'.")
    return True


def merge_to_main(branch, main_branch):
    """Merged den frisch gepushten Feature-Branch in main_branch, komplett in
    einem eigenen, zweiten Worktree - der normale Arbeitsordner (und der
    erste Worktree) bleiben dabei unangetastet. Gibt True zurueck bei
    erfolgreichem Push des Hauptbranches, sonst False (Feature-Branch bleibt
    in dem Fall trotzdem im Fork stehen, zum manuellen Aufraeumen)."""
    print(f"=== Merge: '{branch}' -> '{main_branch}' ===")

    fetch = run(["git", "fetch", "origin", main_branch], cwd=MAIN_REPO_ROOT)
    if fetch.returncode != 0:
        print(f"  [FEHLER] Konnte origin/{main_branch} nicht laden. Feature-Branch bleibt im Fork stehen,")
        print(f"  bitte '{branch}' von Hand mergen.")
        return False

    merge_worktree_path = WORKTREES_PARENT / f"merge-{main_branch}-{branch.replace('/', '-')}"
    result = run(
        ["git", "worktree", "add", "-B", main_branch, str(merge_worktree_path), f"origin/{main_branch}"],
        cwd=MAIN_REPO_ROOT,
    )
    if result.returncode != 0:
        print(f"  [FEHLER] Konnte kein Merge-Worktree anlegen. Feature-Branch bleibt im Fork stehen,")
        print(f"  bitte '{branch}' von Hand mergen.")
        return False

    try:
        merge = run(
            ["git", "merge", "--no-ff", branch, "-m", f"Merge branch '{branch}' into {main_branch}"],
            cwd=merge_worktree_path,
        )
        if merge.returncode != 0:
            print("  [KONFLIKT] Automatischer Merge nicht moeglich (vermutlich haben sich")
            print(f"  '{main_branch}' und '{branch}' ueberschnitten). Breche Merge sauber ab.")
            run(["git", "merge", "--abort"], cwd=merge_worktree_path)
            print(f"  Der Feature-Branch '{branch}' bleibt unveraendert in deinem Fork.")
            print(f"  Bitte von Hand aufloesen, z.B. per Pull Request auf GitHub.")
            return False

        push = run(["git", "push", "origin", f"HEAD:{main_branch}"], cwd=merge_worktree_path)
        if push.returncode != 0:
            print(f"  [FEHLER] Merge lokal ok, aber Push von '{main_branch}' fehlgeschlagen")
            print(f"  (evtl. hat jemand anders inzwischen '{main_branch}' aktualisiert).")
            print(f"  Der Feature-Branch '{branch}' bleibt unveraendert in deinem Fork,")
            print(f"  bitte '{main_branch}' von Hand aktualisieren/mergen.")
            return False

        print(f"  '{main_branch}' erfolgreich aktualisiert und gepusht.")
        return True
    finally:
        remove_worktree(merge_worktree_path)


def main():
    parser = argparse.ArgumentParser(description="Neue AvianVisitors-Arten in einem Rutsch generieren.")
    parser.add_argument("species", nargs="*", help="Eine oder mehrere 'Wissenschaftlich|Englisch' Eintraege")
    parser.add_argument("--file", help="Textdatei mit einer Art pro Zeile (Format 'Wissenschaftlich|Englisch')")
    parser.add_argument("--force", action="store_true", help="Auch bereits vorhandene Bilder neu generieren")
    parser.add_argument("--deploy", action="store_true", help="Am Schluss committen, in den Fork pushen, in den Hauptbranch mergen und das/die Worktree(s) aufraeumen (kein automatisches git pull auf dem Pi)")
    parser.add_argument("--main-branch", default=DEFAULT_MAIN_BRANCH, help=f"Name des Hauptbranches zum Mergen (Standard: {DEFAULT_MAIN_BRANCH})")
    args = parser.parse_args()

    species_list = []
    for raw in args.species:
        species_list.append(parse_species_arg(raw))
    if args.file:
        species_list.extend(load_species_file(args.file))

    if not species_list:
        parser.error("Keine Arten angegeben. Entweder als Argumente oder mit --file.")

    print(f"Verarbeite {len(species_list)} Art(en): " + ", ".join(c for _, c in species_list))

    branch = make_branch_name(species_list)
    print(f"Eigener, isolierter Branch fuer diesen Lauf: {branch}")
    print("Dein Hauptordner bleibt waehrend des ganzen Laufs unberuehrt.")
    print()

    worktree_path = create_worktree(branch)
    if worktree_path is None:
        print("[FEHLER] Konnte kein isoliertes Worktree anlegen, breche ab.")
        sys.exit(1)

    scripts_dir = worktree_path / "avian" / "scripts"
    frontend_dir = worktree_path / "avian" / "frontend"
    illustrations_dir = worktree_path / "avian" / "assets" / "illustrations"
    apt_js = frontend_dir / "apt.js"

    done = []
    failed = []

    try:
        print("=== Schritt 1/3: Illustrationen generieren (pregen.py) ===")
        for sci, com in species_list:
            print(f"- {com} ({sci})")
            ok = pregen_species(scripts_dir, sci, com, args.force)
            if ok:
                done.append((sci, com))
            else:
                print(f"  [FEHLER] Generierung fuer {com} fehlgeschlagen, wird uebersprungen.")
                failed.append(com)
        print()

        if not done:
            print("Keine Art erfolgreich generiert, breche ab.")
            remove_worktree(worktree_path)
            sys.exit(1)

        print("=== Schritt 2/3: Freistellen (cutout.py) ===")
        for sci, com in done:
            slug = slugify(sci)
            print(f"- {com} -> {slug}")
            cutout_species(scripts_dir, slug)
        print()

        print("=== Schritt 3/3: Masken + Versionen aktualisieren ===")
        build_masks(scripts_dir)
        new_version = bump_apt_js(apt_js, done)
        if new_version:
            print(f"  apt.js: SKETCH_VERSION/IMG_VERSION -> r{new_version}")
        print()

        print("=== Fertig ===")
        print(f"Erfolgreich: {len(done)} ({', '.join(c for _, c in done)})")
        if failed:
            print(f"Fehlgeschlagen: {len(failed)} ({', '.join(failed)}) - kannst du einfach nochmal einzeln aufrufen.")
        print()

        paths_to_commit = [apt_js, frontend_dir / "dims.json", frontend_dir / "masks.json"]
        for sci, com in done:
            slug = slugify(sci)
            for suffix in ("", "-2"):
                png = illustrations_dir / f"{slug}{suffix}.png"
                if png.exists():
                    paths_to_commit.append(png)

        if args.deploy:
            print("=== Deploy: commit + push in den Fork ===")
            pushed = commit_and_push(worktree_path, branch, paths_to_commit, done)
            print()
            if pushed:
                remove_worktree(worktree_path)
                print("Worktree aufgeraeumt. Branch liegt jetzt in deinem Fork.")
                print()
                merged = merge_to_main(branch, args.main_branch)
                print()
                if merged:
                    print(f"'{args.main_branch}' ist aktuell. 'git pull' auf dem Pi machst du wie gewohnt von Hand,")
                    print("danach im Browser Strg+Umschalt+R (Hard-Reload) nicht vergessen.")
                else:
                    print(f"Der Feature-Branch '{branch}' ist im Fork, aber noch NICHT in '{args.main_branch}' gemergt.")
                    print("Bitte den Merge von Hand nachholen (siehe Meldung oben), erst danach lohnt sich 'git pull' auf dem Pi.")
            else:
                print(f"Nichts gepusht. Worktree bleibt bestehen zur Kontrolle: {worktree_path}")
        else:
            print(f"Worktree bleibt bestehen (kein --deploy): {worktree_path}")
            print("Zum Veroeffentlichen: 'python new_species.py ... --deploy' beim naechsten Mal,")
            print("oder von Hand im Worktree-Ordner committen/pushen.")
    except Exception:
        print(f"[FEHLER] Unerwarteter Abbruch. Worktree bleibt zur Kontrolle bestehen: {worktree_path}")
        raise


if __name__ == "__main__":
    main()
