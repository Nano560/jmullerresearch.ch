"""
Add a text watermark to one or more existing mp4s via ffmpeg's drawtext
filter. Independent post-process step — does not modify the input file.

Always writes a NEW file (`<stem>_wm.mp4`) alongside each input so the
unwatermarked original is preserved (you can re-run with different
text/position/style). Audio is stream-copied through.

Run from the website repo root:
    python3 scripts/add_watermark.py path/to/foo.mp4
    python3 scripts/add_watermark.py *.mp4 --text='jmullerresearch.ch'

Defaults match the previous in-mux watermark (mid-gray "jmullerresearch.ch"
in the top-right, ~3% of video height). The watermark is fast to apply
because video re-encoding is fast at high CRF; expect ~real-time speeds
on a modern CPU.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys


def _ffprobe_height(path):
    """Returns video stream height in pixels via ffprobe."""
    out = subprocess.check_output([
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=height",
        "-of", "json", path,
    ])
    return int(json.loads(out)["streams"][0]["height"])


def _resolve_px(spec, frame_h):
    """`Npx` literal or `N%` of video height → integer pixels."""
    s = spec.strip()
    if s.endswith("%"):
        return int(round(frame_h * float(s[:-1]) / 100.0))
    return int(s)


def _build_drawtext(args, frame_h):
    """drawtext filter clause anchored at the requested corner, with a
    mid-gray fontcolor (visible on both light and dark backgrounds, no
    glyph stroke needed)."""
    pad = _resolve_px(args.margin, frame_h)
    pos_xy = {
        "top-left":      (f"{pad}",          f"{pad}"),
        "top-right":     (f"w-tw-{pad}",     f"{pad}"),
        "bottom-left":   (f"{pad}",          f"h-th-{pad}"),
        "bottom-right":  (f"w-tw-{pad}",     f"h-th-{pad}"),
        "top-center":    (f"(w-tw)/2",       f"{pad}"),
        "bottom-center": (f"(w-tw)/2",       f"h-th-{pad}"),
    }
    x_expr, y_expr = pos_xy[args.position]
    fs_px = _resolve_px(args.fontsize, frame_h)
    # drawtext text-value escapes (same conservative set used elsewhere
    # in the pipeline).
    safe = (args.text
            .replace("\\", "\\\\")
            .replace(":", "\\:")
            .replace("%", "\\%")
            .replace("'", r"\'"))
    return (f"drawtext=text='{safe}':"
            f"fontfile='{args.fontfile}':"
            f"fontsize={fs_px}:"
            f"fontcolor={args.color}:"
            f"x={x_expr}:y={y_expr}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+",
                    help="One or more mp4 paths to watermark.")
    ap.add_argument("--text", default="jmullerresearch.ch",
                    help="Watermark text. Pass an empty string to disable "
                         "(no-op).")
    ap.add_argument("--position", default="top-right",
                    choices=["top-left", "top-right", "bottom-left",
                             "bottom-right", "top-center", "bottom-center"],
                    help="Anchor corner / edge. Default top-right.")
    ap.add_argument("--fontsize", default="3%",
                    help="Either literal pixels ('36') or percentage of "
                         "video height ('3%%'). Default 3%%.")
    ap.add_argument("--margin", default="2%",
                    help="Distance from the nearest video edge. Same "
                         "format as --fontsize: literal pixels ('20') "
                         "or percentage of video height ('2%%'). Default "
                         "2%% scales cleanly across resolutions — at "
                         "1080p this is 22px, at 4K it's 43px.")
    ap.add_argument("--color", default="gray",
                    help="ffmpeg drawtext fontcolor. Default 'gray' "
                         "(#808080) reads on light AND dark backgrounds "
                         "without needing a glyph stroke.")
    ap.add_argument("--fontfile",
                    default="/System/Library/Fonts/Helvetica.ttc",
                    help="Path to a TTF/TTC font. macOS Helvetica default. "
                         "On Linux try DejaVuSans.ttf. Requires an ffmpeg "
                         "build with libfreetype (drawtext filter).")
    ap.add_argument("--crf", type=int, default=18,
                    help="x264 quality (lower = better, larger). Default 18.")
    args = ap.parse_args()

    if not args.text:
        print("--text is empty; nothing to do.")
        return

    if shutil.which("ffmpeg") is None:
        sys.exit("ffmpeg not found in PATH. brew install ffmpeg.")
    if shutil.which("ffprobe") is None:
        sys.exit("ffprobe not found in PATH (ships with ffmpeg).")

    for in_path in args.inputs:
        in_path = os.path.abspath(in_path)
        if not os.path.isfile(in_path):
            print(f"SKIP missing input: {in_path}")
            continue

        frame_h = _ffprobe_height(in_path)
        drawtext = _build_drawtext(args, frame_h)

        stem, ext = os.path.splitext(in_path)
        out_path = f"{stem}_wm{ext}"

        cmd = [
            "ffmpeg", "-y",
            "-i", in_path,
            "-vf", drawtext,
            "-c:v", "libx264",
            "-crf", str(args.crf),
            "-pix_fmt", "yuv420p",
            "-c:a", "copy",   # stream-copy audio if present; harmless if absent
            out_path,
        ]
        print(f"\n=== {os.path.basename(in_path)} ===")
        print("Running:", " ".join(cmd))
        try:
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError as e:
            print(f"!! ffmpeg failed (rc={e.returncode}); leaving original "
                  f"untouched.")
            if os.path.exists(out_path):
                try:
                    os.unlink(out_path)
                except OSError:
                    pass
            continue

        print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
