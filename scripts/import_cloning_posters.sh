#!/usr/bin/env bash
#
# Make the poster images of the four acoustic cloning film cuts (long, short, story, hearing).
#
# The film's renders folder holds one light and one dark poster per cut and tier
# (<tier>/cuts/<cut>/acoustic-cloning-<cut>-<tier>-v2.0[-dark]-poster.png). This turns them into the small JPEGs
# the video switcher shows: images/video-cloning-<cut>.jpg (dark) and images/video-cloning-<cut>-light.jpg,
# each at its film's shape (16:9, 9:16, 1:1). The posters are still being designed and the production tier will
# give way to the publication tier, so run this again when they change; the file names stay the same.
#
# Requires: ffmpeg  (macOS: `brew install ffmpeg`)
#
# Usage (from the website repo root):
#     scripts/import_cloning_posters.sh path/to/film                    # production tier
#     scripts/import_cloning_posters.sh path/to/film publication

set -euo pipefail

FILM_DIR="${1:-}"
TIER="${2:-production}"

if [[ -z "$FILM_DIR" ]]; then
    echo "Usage: scripts/import_cloning_posters.sh FILM_DIR [TIER]" >&2
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
            src="$FILM_DIR/$TIER/cuts/$cut/acoustic-cloning-$cut-$TIER-v2.0-dark-poster.png"
            out="images/video-cloning-$cut.jpg"
        else
            src="$FILM_DIR/$TIER/cuts/$cut/acoustic-cloning-$cut-$TIER-v2.0-poster.png"
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
