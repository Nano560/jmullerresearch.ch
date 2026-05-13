#!/usr/bin/env python3
"""
Regenerate sitemap.xml from the .html files on disk.

Walks the website root for *.html (skipping a small set of asset/build
directories) and writes a fresh sitemap.xml at the repo root. Each entry
uses the file's mtime as <lastmod>, so the timestamp in the sitemap is
"the last time the source file changed" -- which is what search engines
treat as a freshness signal.

Conventions:
  - index.html at the root collapses to the bare "/" URL.
  - index.html gets priority 1.0; everything else gets 0.8.
  - changefreq is "monthly" for all entries -- this is a personal site
    that doesn't change daily. Adjust below if that ever changes.

Usage (from the website repo root):
    scripts/generate_sitemap.py
"""

import datetime
import pathlib
import sys
import xml.etree.ElementTree as ET

BASE_URL = "https://jmullerresearch.ch"
ROOT = pathlib.Path(__file__).resolve().parent.parent

# Directories whose .html files should NOT be in the sitemap. Add to
# this list if you ever introduce something like drafts/ or private/.
EXCLUDE_DIRS = {".git", "scripts", "src", "misc", "images"}

SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"


def url_for(rel_posix: str) -> str:
    """Map a repo-relative HTML path to its public URL."""
    if rel_posix == "index.html":
        return f"{BASE_URL}/"
    return f"{BASE_URL}/{rel_posix}"


def priority_for(rel_posix: str) -> str:
    """Higher priority for the homepage, default for everything else."""
    return "1.0" if rel_posix == "index.html" else "0.8"


def collect_html_files() -> list[pathlib.Path]:
    """Recursively gather .html files under ROOT, skipping EXCLUDE_DIRS."""
    out = []
    for p in sorted(ROOT.rglob("*.html")):
        rel_parts = p.relative_to(ROOT).parts
        # Skip anything inside an excluded directory at any depth.
        if any(part in EXCLUDE_DIRS for part in rel_parts[:-1]):
            continue
        out.append(p)
    return out


def build_sitemap(files: list[pathlib.Path]) -> ET.ElementTree:
    """Build an ElementTree representing the sitemap XML."""
    ET.register_namespace("", SITEMAP_NS)
    urlset = ET.Element(f"{{{SITEMAP_NS}}}urlset")

    for p in files:
        rel = p.relative_to(ROOT).as_posix()
        mtime = datetime.date.fromtimestamp(p.stat().st_mtime).isoformat()

        url_el = ET.SubElement(urlset, f"{{{SITEMAP_NS}}}url")
        ET.SubElement(url_el, f"{{{SITEMAP_NS}}}loc").text = url_for(rel)
        ET.SubElement(url_el, f"{{{SITEMAP_NS}}}lastmod").text = mtime
        ET.SubElement(url_el, f"{{{SITEMAP_NS}}}changefreq").text = "monthly"
        ET.SubElement(url_el, f"{{{SITEMAP_NS}}}priority").text = priority_for(rel)

    ET.indent(urlset, space="  ")
    return ET.ElementTree(urlset)


def main() -> None:
    files = collect_html_files()
    if not files:
        sys.exit("No .html files found under " + str(ROOT))

    tree = build_sitemap(files)
    out_path = ROOT / "sitemap.xml"
    with open(out_path, "wb") as f:
        f.write(b'<?xml version="1.0" encoding="UTF-8"?>\n')
        tree.write(f, xml_declaration=False, encoding="utf-8")
        f.write(b"\n")  # trailing newline -- friendlier for git diffs

    print(f"Wrote {out_path} with {len(files)} URL(s):")
    for p in files:
        rel = p.relative_to(ROOT).as_posix()
        print(f"  {url_for(rel)}")


if __name__ == "__main__":
    main()
