#!/usr/bin/env bash
#
# Make the poster image for one video on a project page.
#
# Grabs one frame from a film at the given time and writes it as a JPEG at the
# film's own aspect ratio (the video switcher shows each film at its native
# shape, so nothing is cropped). Also prints the data-aspect value for the
# <figure class="video-item"> and the size of the result: keep posters to a
# few tens of KB, like the existing ones in images/.
#
# Requires: ffmpeg  (macOS: `brew install ffmpeg`)
#
# Usage (from the website repo root):
#     scripts/make_poster.sh path/to/film.mp4 SECONDS images/video-NAME.jpg
#     scripts/make_poster.sh path/to/film.mp4 SECONDS images/video-NAME.jpg 960
#
# The last argument is the poster width in pixels (default 1280). Use a smaller
# one for square and vertical films.

set -euo pipefail

FILM="${1:-}"
AT="${2:-}"
OUT="${3:-}"
WIDTH="${4:-1280}"

if [[ -z "$FILM" || -z "$AT" || -z "$OUT" ]]; then
    echo "Usage: scripts/make_poster.sh film.mp4 SECONDS out.jpg [WIDTH]" >&2
    exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
    echo "Error: ffmpeg not found. Install with:  brew install ffmpeg" >&2
    exit 1
fi

if [[ ! -f "$FILM" ]]; then
    echo "Error: film not found: $FILM" >&2
    exit 1
fi

# Quality 5 (~75) keeps flat-colour diagrams crisp at a small size.
ffmpeg -y -hide_banner -loglevel error \
    -ss "$AT" -i "$FILM" \
    -frames:v 1 \
    -vf "scale=${WIDTH}:-2:flags=lanczos" \
    -q:v 5 \
    "$OUT"

if [[ ! -s "$OUT" ]]; then
    echo "Error: no frame at ${AT}s in $FILM (is it past the end?)" >&2
    exit 1
fi

DIMS="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$OUT")"
W="${DIMS%x*}"
H="${DIMS#*x}"

# Reduce W/H to the smallest whole ratio (1920x1080 -> 16/9)
a=$W
b=$H
while [[ $b -ne 0 ]]; do
    t=$((a % b))
    a=$b
    b=$t
done

echo "$OUT  ${W}x${H}  data-aspect=\"$((W / a))/$((H / a))\"  $(( $(wc -c < "$OUT") / 1024 )) KB"
