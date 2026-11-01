#!/usr/bin/env python3
"""
Check that every address in permanent-urls.txt still resolves to a file.

A QR code on a published video cannot be changed, so the page it points to
must stay where it is. This lists the pages that a code points to and fails
when one is missing, so a rename or a deletion is caught before it is pushed.
A redirect stub left at the old name counts: the file is what keeps the
address alive.

Usage (from anywhere inside the repo):
    scripts/check_permanent_urls.py                  # the files on disk
    scripts/check_permanent_urls.py --rev <commit>   # the tree of a commit (what a push publishes)
    scripts/check_permanent_urls.py --list FILE      # another list

Exit 0 when every address is there, 1 when one is missing or the list is
empty or unreadable (a check that ran nothing is not a pass).
"""

import argparse
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
DEFAULT_LIST = HERE / "permanent-urls.txt"
DEFAULT_REPO = HERE.parent


def read_list(path: pathlib.Path) -> list[str]:
    """The addresses in the list file: one path per line, comments and blank lines skipped."""
    paths = []
    for n, raw in enumerate(path.read_text().splitlines(), 1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        if not line.startswith("/") or ".." in line.split("/") or any(c.isspace() for c in line):
            sys.exit(f"{path}:{n}: {raw!r} is not an absolute path on the site (e.g. /page.html)")
        paths.append(line)
    return paths


def file_for(address: str) -> str:
    """The file GitHub Pages serves for an address: "/" is index.html, "/x/" is x/index.html."""
    rel = address.lstrip("/")
    if rel == "" or rel.endswith("/"):
        rel += "index.html"
    return rel


def exists(repo: pathlib.Path, rel: str, rev: str | None) -> bool:
    if rev is None:
        return (repo / rel).is_file()
    # `rev:path` also peels a tag, so a pushed tag is checked as the commit it points to.
    return subprocess.run(["git", "-C", str(repo), "cat-file", "-e", f"{rev}:{rel}"],
                          capture_output=True).returncode == 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rev", help="check this commit's tree instead of the files on disk")
    ap.add_argument("--list", type=pathlib.Path, default=DEFAULT_LIST)
    ap.add_argument("--repo", type=pathlib.Path, default=DEFAULT_REPO, help="the repo to check (default: this one)")
    a = ap.parse_args(argv)

    if not a.list.is_file():
        print(f"permanent addresses: {a.list} is missing", file=sys.stderr)
        return 1
    addresses = read_list(a.list)
    if not addresses:
        print(f"permanent addresses: {a.list} lists none, so this check would pass vacuously", file=sys.stderr)
        return 1
    missing = [(addr, file_for(addr)) for addr in addresses if not exists(a.repo, file_for(addr), a.rev)]
    where = f"commit {a.rev[:12]}" if a.rev else "the files on disk"
    for addr, rel in missing:
        print(f"permanent address {addr} has no file ({rel}) in {where}: a QR code on a published video points here. "
              "Keep the file, or leave a redirect page at this name.", file=sys.stderr)
    if not missing:
        print(f"permanent addresses: {len(addresses)} present in {where}")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
