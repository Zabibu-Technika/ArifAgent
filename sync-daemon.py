#!/usr/bin/env python3
"""Keep Arif Agent's inherited core in step with Zabibu Weaver.

Arif Agent is a multi-axis extension of Weaver: it owns the growth and bizops engines, and it
inherits the verification, memory, safety and routing core rather than forking it. A fork
would drift within a week, and the first thing to drift would be a safety default.

LAYOUT
    Projects/
      ZabibuWeaver/         <- upstream: core/, engines/coding/
      ArifAgent/            <- this project: engines/growth/, engines/bizops/
        core/               <- generated copy
        engines/coding/     <- generated copy

WHY COPIES AND NOT SYMLINKS
    Symlinks on Windows need either Developer Mode or an elevated shell, and a project
    that only builds on a developer's machine is not a project that ships. Copies work
    everywhere. The cost is that downstream edits can diverge, so the manifest exists:
    every copied file is hashed, and a destination that no longer matches what we last
    wrote is treated as a local edit and never overwritten without --force.

USAGE
    python sync-daemon.py                  sync once from ../ZabibuWeaver
    python sync-daemon.py --check          report drift, change nothing, exit 1 if drifted
    python sync-daemon.py --watch 30       re-check every 30 seconds
    python sync-daemon.py --prune          remove files deleted upstream (only if unmodified)
    python sync-daemon.py --force          overwrite downstream edits (destructive)
    python sync-daemon.py --upstream PATH  use a different upstream checkout

Exit codes: 0 clean, 1 drift/conflict, 2 usage or environment error.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

ARIF_AGENT_ROOT = Path(__file__).resolve().parent


def default_upstream() -> Path:
    """Find the sibling Weaver checkout across the old and split repo names."""
    for name in ("ZabibuWeaver", "Zabibu Weaver", "zabibu-weaver"):
        candidate = ARIF_AGENT_ROOT.parent / name
        if (candidate / "core").is_dir():
            return candidate
    # Fall back to the split-repo name so the error message points at the right clone.
    return ARIF_AGENT_ROOT.parent / "ZabibuWeaver"


UPSTREAM_DEFAULT = default_upstream()

MANIFEST = ARIF_AGENT_ROOT / ".sync-manifest.json"

# Directories inherited from the Weaver core. Arif Agent's own engines are not listed here:
# they are source, not a copy.
SOURCES = ("core", "engines/coding")

SKIP_DIRS = {"__pycache__", "node_modules", ".git", ".weaver", ".venv", "venv"}
SKIP_SUFFIXES = (".test.ts", ".test.py", ".pyc", ".log")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def iter_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    found: list[Path] = []
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if name.endswith(SKIP_SUFFIXES):
                continue
            found.append(Path(base) / name)
    return sorted(found)


def load_manifest() -> dict[str, dict[str, str]]:
    try:
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_manifest(manifest: dict[str, dict[str, str]]) -> None:
    MANIFEST.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def sync_once(
    *, upstream: Path, check: bool, force: bool, prune: bool
) -> tuple[int, list[str]]:
    manifest = load_manifest()
    messages: list[str] = []
    problems = 0
    seen: set[str] = set()
    missing_source = False

    for source in SOURCES:
        source_root = upstream / source
        if not source_root.is_dir():
            messages.append(f"missing upstream source: {source_root}")
            problems += 1
            missing_source = True
            continue

        for src in iter_files(source_root):
            rel = src.relative_to(upstream).as_posix()
            seen.add(rel)
            dest = ARIF_AGENT_ROOT / rel
            src_hash = sha256(src)
            recorded = manifest.get(rel, {}).get("hash")

            if not dest.exists():
                messages.append(f"add     {rel}")
                if not check:
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(src.read_bytes())
                    manifest[rel] = {"hash": src_hash}
                continue

            dest_hash = sha256(dest)
            if dest_hash == src_hash:
                manifest[rel] = {"hash": src_hash}
                continue

            if recorded is not None and dest_hash == recorded:
                # The destination is exactly what we last wrote, and upstream moved on.
                messages.append(f"update  {rel}")
                if not check:
                    dest.write_bytes(src.read_bytes())
                    manifest[rel] = {"hash": src_hash}
                continue

            if force:
                messages.append(f"force   {rel} (downstream edit discarded)")
                if not check:
                    dest.write_bytes(src.read_bytes())
                    manifest[rel] = {"hash": src_hash}
                continue

            messages.append(
                f"CONFLICT {rel}: edited downstream and upstream. "
                "Resolve by hand, or rerun with --force to discard the downstream copy."
            )
            problems += 1

    if prune and missing_source:
        # If a source tree is missing, every file under it looks "deleted upstream". It
        # is not; the checkout is incomplete. Deleting the copies would turn a bad path
        # into data loss.
        messages.append(
            "prune skipped: an upstream source is missing, so absence is not evidence"
        )
        prune = False

    if prune:
        for rel in sorted(set(manifest) - seen):
            dest = ARIF_AGENT_ROOT / rel
            if not dest.exists():
                if not check:
                    manifest.pop(rel, None)
                continue
            recorded = manifest[rel].get("hash")
            if recorded is not None and sha256(dest) != recorded and not force:
                messages.append(
                    f"CONFLICT prune {rel}: modified downstream, not removing"
                )
                problems += 1
                continue
            messages.append(f"prune   {rel}")
            if not check:
                dest.unlink()
                manifest.pop(rel, None)

    if not check:
        save_manifest(manifest)

    if not messages:
        messages.append("up to date")
    return problems, messages


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Sync the Weaver core into Arif Agent."
    )
    parser.add_argument(
        "--check", action="store_true", help="report drift without changing files"
    )
    parser.add_argument("--force", action="store_true", help="discard downstream edits")
    parser.add_argument(
        "--prune", action="store_true", help="remove files deleted upstream"
    )
    parser.add_argument(
        "--watch", type=float, metavar="SECONDS", help="re-check on an interval"
    )
    parser.add_argument(
        "--upstream",
        type=Path,
        default=UPSTREAM_DEFAULT,
        metavar="PATH",
        help="upstream Weaver checkout (default: sibling 'ZabibuWeaver')",
    )
    args = parser.parse_args(argv)

    upstream = args.upstream.resolve()
    if not upstream.is_dir():
        print(f"error: upstream root not found: {upstream}", file=sys.stderr)
        return 2

    while True:
        problems, messages = sync_once(
            upstream=upstream, check=args.check, force=args.force, prune=args.prune
        )
        stamp = time.strftime("%H:%M:%S")
        for line in messages:
            print(f"[{stamp}] {line}")
        if problems:
            print(f"[{stamp}] {problems} conflict(s)", file=sys.stderr)

        if args.watch is None:
            return 1 if (problems or args.check and "up to date" not in messages) else 0
        time.sleep(max(1.0, args.watch))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
