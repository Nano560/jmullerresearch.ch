#!/usr/bin/env bash
#
# Make the poster images of the four acoustic cloning film cuts (long, short, story, hearing).
#
# The film's films/ folder holds one light and one dark poster per cut and tier, flat
# (acoustic-cloning-<cut>-<tier>[-dark]-poster.png; light is the name without -dark). This turns them into the
# small JPEGs the video switcher shows: images/video-cloning-<cut>.jpg (dark) and images/video-cloning-<cut>-light.jpg,
# each at its film's shape (16:9, 9:16, 1:1). The site shows the publication tier, the finest. Run this again when a
# poster changes; the file names stay the same. Only the cylinder (the paper's object) is used; the square and
# cross posters carry -square / -cross after the tier.
#
# Requires: ffmpeg  (macOS: `brew install ffmpeg`)
#
# Usage (from the website repo root):
#     scripts/import_cloning_posters.sh path/to/films                  # publication tier
#     scripts/import_cloning_posters.sh path/to/films production

set -euo pipefail

FILMS_DIR="${1:-}"
TIER="${2:-publication}"

if [[ -z "$FILMS_DIR" ]]; then
    echo "Usage: scripts/import_cloning_posters.sh FILMS_DIR [TIER]" >&2
    exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "Error: ffmpeg not found. Install with:  brew install ffmpeg" >&2
    exit 1
fi

# cut:width in pixels (the height follows from the poster's own shape)
for entry in long:1280 short:720 story:960 hearing:960; do
    cut="${entry%%:*}"
    width="${entry##*:}"
    for theme in light dark; do
        if [[ "$theme" == dark ]]; then
            src="$FILMS_DIR/acoustic-cloning-$cut-$TIER-dark-poster.png"
            out="images/video-cloning-$cut.jpg"
        else
            src="$FILMS_DIR/acoustic-cloning-$cut-$TIER-poster.png"
            out="images/video-cloning-$cut-light.jpg"
        fi
        if [[ ! -f "$src" ]]; then
            echo "Error: poster not found: $src" >&2
            exit 1
        fi
        ffmpeg -y -hide_banner -loglevel error -i "$src" -frames:v 1 \
            -vf "scale=${width}:-2:flags=lanczos" -q:v 5 "$out"
        echo "$out  $(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$out")  $(( $(wc -c < "$out") / 1024 )) KB"
    done
done
