#!/usr/bin/env bash
#
# Regenerate responsive image + video variants for the background.
#
# Takes an 8K (or any high-res 16:9) master PNG + MP4 and produces:
#   - expanding_shells_lqip.jpg  (~2 KB blurred placeholder)
#   - expanding_shells_1280.jpg, _1920.jpg, _2560.jpg  (responsive image variants)
#   - expanding_shells_720.mp4, _1080.mp4, _1440.mp4  (responsive video variants)
#
# Requires: ffmpeg  (macOS: `brew install ffmpeg`)
#
# Usage (from the website repo root):
#     scripts/generate_media.sh
#     scripts/generate_media.sh path/to/source.png path/to/source.mp4
#
# Default master paths are src/expanding_shells.png and src/expanding_shells.mp4.
# The src/ directory is gitignored so the masters stay local only.

set -euo pipefail

SRC_IMG="${1:-src/expanding_shells.png}"
SRC_VID="${2:-src/expanding_shells.mp4}"
OUT_DIR="images"
NAME="expanding_shells"

# ---------- preflight ----------

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "Error: ffmpeg not found. Install with:  brew install ffmpeg" >&2
    exit 1
fi

if [[ ! -f "$SRC_IMG" ]]; then
    echo "Error: source image not found: $SRC_IMG" >&2
    exit 1
fi

if [[ ! -f "$SRC_VID" ]]; then
    echo "Error: source video not found: $SRC_VID" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"

echo "Generating variants from:"
echo "  image: $SRC_IMG"
echo "  video: $SRC_VID"
echo "Output: $OUT_DIR/"
echo

# ---------- LQIP ----------
# 40px wide, gaussian-blurred, low-quality JPEG. Inlined/served as a tiny
# placeholder that is visible before the main image loads.

echo "[1/7] LQIP (40w, blurred)..."
ffmpeg -y -hide_banner -loglevel error \
    -i "$SRC_IMG" \
    -vf "scale=40:-2:flags=lanczos,gblur=sigma=1.5" \
    -q:v 7 \
    "$OUT_DIR/${NAME}_lqip.jpg"

# ---------- image variants ----------
# Three widths for <img srcset>. 2560 covers retina/4K,
# 1920 covers most desktops, 1280 covers phones and small laptops.
# Quality 3 (~82) is a good tradeoff for photographic content.

IMG_STEP=2
for W in 1280 1920 2560; do
    IMG_STEP=$((IMG_STEP + 1))
    echo "[${IMG_STEP}/7] image ${W}w..."
    ffmpeg -y -hide_banner -loglevel error \
        -i "$SRC_IMG" \
        -vf "scale=${W}:-2:flags=lanczos" \
        -q:v 3 \
        "$OUT_DIR/${NAME}_${W}.jpg"
done

# ---------- video variants ----------
# Three heights: 720p (phones), 1080p (desktops), 1440p (large).
# CRF 26, slow preset, yuv420p for broad compatibility, +faststart so
# playback can begin before the full file is downloaded.
# Audio is stripped (-an) since this is a muted background loop.
#
# Ping-pong: each variant is forward followed by reversed, so when the
# browser loops the file it plays A->B->A->B... with no visible jump.
# Result is 2x the source duration (6 s -> 12 s).
#
# Pairs: width -> height-label
#   1280 -> 720
#   1920 -> 1080
#   2560 -> 1440

VID_STEP=4
for PAIR in "1280:720" "1920:1080" "2560:1440"; do
    VID_STEP=$((VID_STEP + 1))
    W="${PAIR%%:*}"
    H="${PAIR##*:}"
    echo "[${VID_STEP}/7] video ${H}p (forward + reverse)..."
    # Scale once, split into two streams, reverse one, concat them.
    # Drop the duplicated seam frame on the reverse half (trim=start_frame=1)
    # so the join is frame-exact with no 1-frame stutter.
    ffmpeg -y -hide_banner -loglevel error \
        -i "$SRC_VID" \
        -filter_complex "[0:v]scale=${W}:-2:flags=lanczos,split=2[fwd][rev];\
[rev]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[revtrim];\
[fwd][revtrim]concat=n=2:v=1[out]" \
        -map "[out]" \
        -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
        -movflags +faststart -an \
        "$OUT_DIR/${NAME}_${H}.mp4"
done

# ---------- summary ----------

OUTPUTS=(
    "$OUT_DIR/${NAME}_lqip.jpg"
    "$OUT_DIR/${NAME}_1280.jpg"
    "$OUT_DIR/${NAME}_1920.jpg"
    "$OUT_DIR/${NAME}_2560.jpg"
    "$OUT_DIR/${NAME}_720.mp4"
    "$OUT_DIR/${NAME}_1080.mp4"
    "$OUT_DIR/${NAME}_1440.mp4"
)

echo
echo "Done. Output sizes:"
ls -lh "${OUTPUTS[@]}" | awk '{printf "  %-40s %s\n", $NF, $5}'

# ---------- cleanup masters ----------
# Verify every expected output exists and is non-empty before deleting
# the source masters. If any output is missing or empty the masters stay.

all_ok=1
for f in "${OUTPUTS[@]}"; do
    if [[ ! -s "$f" ]]; then
        all_ok=0
        echo "Warning: $f is missing or empty -- keeping source masters." >&2
        break
    fi
done

if [[ $all_ok -eq 1 ]]; then
    echo
    echo "All outputs verified. Removing source masters:"
    for src in "$SRC_IMG" "$SRC_VID"; do
        if [[ -f "$src" ]]; then
            rm -v -- "$src"
        fi
    done
fi
