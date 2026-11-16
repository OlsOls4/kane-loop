#!/usr/bin/env bash
# Assemble the Kane Loop demo video — FIX PASS (15 Nov 2026).
# From captured frames + Paloma narration (407 words, speed 100).
# Run after: capture2.mjs (frames in /tmp/kane-video/cap) + render-frames.py
# (frames in /tmp/kane-video/frames) + narration in video/audio/ (seg1..7 mp3)
# + make-srt.py (video/captions.srt).
# Output: video/kane-loop-demo-draft.mp4 (no captions) -> kane-loop-demo.mp4
# (captions burned in from video/captions.srt).
# Segment durations MUST equal the narration mp3 durations (ffprobe-measured):
#   seg1 18.240, seg2 21.168, seg3 25.632, seg4 25.968,
#   seg5 21.960, seg6 29.088, seg7 9.432; gaps 0.5s x6; total 154.488s.
# No fixture frame: every run_end shown is a live result. Replay leg is
# unproven (4x analyzer failures) and says so on screen.
set -euo pipefail
V=~/workspace/goals/win-cash-with-kane-loop-at-testmu-kane-cli-hackathon/build/kane-loop/video
W=/tmp/kane-video
CAP=$W/cap
FR=$W/frames
AU=$V/audio
SEG=$W/segments
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
mkdir -p "$SEG" "$W/lt"

printf '%s' 'Seeded bug — disclosed. Reproduced locally.' > "$W/lt/seeded.txt"
printf '%s' 'Fixed build — mode toggle (demo switch, not an autonomous fix)' > "$W/lt/fixed.txt"
printf '%s' 'O1 green — result_code 100 · fresh author run' > "$W/lt/o1green.txt"
printf '%s' 'O2 green — result_code 100 · 1 order · stock −2' > "$W/lt/o2green.txt"
printf '%s' "Replay leg unproven — Kane's replay analyzer failed 4×" > "$W/lt/replay.txt"
printf '%s' 'O1 first caught a real bug — Pay stuck on Processing (740), fixed, then green' > "$W/lt/timer.txt"

still() {
  local img="$1" dur="$2" out="$3" bot="${4:-}" top="${5:-}"
  local vf="scale=2732:1536,zoompan=z='min(zoom+0.0008,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=1366x768:fps=25"
  if [ -n "$bot" ]; then
    vf="$vf,drawtext=fontfile=$FONT:textfile=$bot:fontsize=30:fontcolor=white:borderw=2:bordercolor=black:box=1:boxcolor=0x00000088:boxborderw=12:x=(w-text_w)/2:y=h-92"
  fi
  if [ -n "$top" ]; then
    vf="$vf,drawtext=fontfile=$FONT:textfile=$top:fontsize=28:fontcolor=white:borderw=2:bordercolor=black:box=1:boxcolor=0x00000088:boxborderw=12:x=(w-text_w)/2:y=36"
  fi
  ffmpeg -y -v error -loop 1 -i "$img" -vf "$vf" -t "$dur" -c:v libx264 -pix_fmt yuv420p -r 25 "$out"
}
burst() {
  ffmpeg -y -v error -framerate 6 -i "$1/frame-%04d.jpg" -vf "scale=1366:768,format=yuv420p" -r 25 -c:v libx264 -pix_fmt yuv420p "$2"
}
vconcat() {
  ffmpeg -y -v error -f concat -safe 0 -i "$1" -c copy "$2"
}
mux() {
  ffmpeg -y -v error -i "$1" -i "$2" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -ar 48000 -ac 2 -t "$3" "$4"
}
seglist() {
  local d="$1"; : > "$d/list.txt"
  for c in "$d"/clip-*.mp4; do printf "file '%s'\n" "$c" >> "$d/list.txt"; done
}

S=$SEG
# ---------- seg1 hook (18.240) ----------
mkdir -p $S/s1
still $CAP/a-cart-before-pay.png 2.0 $S/s1/clip-00.mp4
burst $CAP/hook $S/s1/clip-01.mp4
burst $CAP/hook-ledger $S/s1/clip-02.mp4
still $CAP/hook-ledger/frame-0006.jpg 12.240 $S/s1/clip-03.mp4 "$W/lt/seeded.txt"
seglist $S/s1; vconcat $S/s1/list.txt $S/s1/v.mp4; mux $S/s1/v.mp4 $AU/seg1-hook.mp3 18.240 $S/s1.mp4

# ---------- seg2 install (21.168) ----------
mkdir -p $S/s2
still $FR/f-terminal-install.png 21.168 $S/s2/clip-01.mp4
seglist $S/s2; vconcat $S/s2/list.txt $S/s2/v.mp4; mux $S/s2/v.mp4 $AU/seg2-install.mp3 21.168 $S/s2.mp4

# ---------- seg3 bug (25.632) — live checkout + O1 first-run 740 + console timeline ----------
mkdir -p $S/s3
still $CAP/d-live-checkout-top.png 6.0 $S/s3/clip-01.mp4
still $FR/f-o1first-runend.png 10.0 $S/s3/clip-02.mp4 "$W/lt/timer.txt"
still $CAP/console-timeline-crop.png 9.632 $S/s3/clip-03.mp4
seglist $S/s3; vconcat $S/s3/list.txt $S/s3/v.mp4; mux $S/s3/v.mp4 $AU/seg3-bug.mp3 25.632 $S/s3.mp4

# ---------- seg4 output (25.968) — npm test 100/100 + real O2-red run_end (no fixture) ----------
mkdir -p $S/s4
still $FR/f-terminal-npmtest.png 12.0 $S/s4/clip-01.mp4
still $FR/f-o2red-runend.png 13.968 $S/s4/clip-02.mp4
seglist $S/s4; vconcat $S/s4/list.txt $S/s4/v.mp4; mux $S/s4/v.mp4 $AU/seg4-output.mp3 25.968 $S/s4.mp4

# ---------- seg5 fix (21.960) — fixed build footage + real patch guards ----------
mkdir -p $S/s5
burst $CAP/fixed $S/s5/clip-01.mp4
burst $CAP/fixed-confirm $S/s5/clip-02.mp4
still $CAP/c-full-after.png 8.0 $S/s5/clip-03.mp4 "$W/lt/fixed.txt"
still $FR/f-fix-diff.png 9.960 $S/s5/clip-04.mp4
seglist $S/s5; vconcat $S/s5/list.txt $S/s5/v.mp4; mux $S/s5/v.mp4 $AU/seg5-fix.mp3 21.960 $S/s5.mp4

# ---------- seg6 live (29.088) — O1 green + O2 green (deploy 7) + console top, replay caveat ----------
mkdir -p $S/s6
still $FR/f-o1green-runend.png 9.0 $S/s6/clip-01.mp4 "$W/lt/o1green.txt"
still $FR/f-o2green-runend.png 10.0 $S/s6/clip-02.mp4 "$W/lt/o2green.txt"
still $CAP/console-top-crop.png 10.088 $S/s6/clip-03.mp4 "$W/lt/replay.txt"
seglist $S/s6; vconcat $S/s6/list.txt $S/s6/v.mp4; mux $S/s6/v.mp4 $AU/seg6-live.mp3 29.088 $S/s6.mp4

# ---------- seg7 end (9.432) ----------
mkdir -p $S/s7
still $FR/f-endcard.png 9.432 $S/s7/clip-01.mp4
seglist $S/s7; vconcat $S/s7/list.txt $S/s7/v.mp4; mux $S/s7/v.mp4 $AU/seg7-end.mp3 9.432 $S/s7.mp4

# ---------- gaps (0.5s black + silence) ----------
ffmpeg -y -v error -f lavfi -i color=c=black:s=1366x768:r=25:d=0.5 -f lavfi -i anullsrc=r=48000:cl=stereo -t 0.5 -c:v libx264 -pix_fmt yuv420p -r 25 -c:a aac -shortest $S/gap.mp4

# ---------- final concat ----------
: > $S/final-list.txt
for p in s1 gap s2 gap s3 gap s4 gap s5 gap s6 gap s7; do printf "file '%s/%s.mp4'\n" "$S" "$p" >> $S/final-list.txt; done
ffmpeg -y -v error -f concat -safe 0 -i $S/final-list.txt -c copy $V/kane-loop-demo-draft.mp4
# ---------- burn captions (MarginV=120: captions sit ABOVE the lower-thirds) ----------
# PlayResX/PlayResY MUST match the video, or libass scales FontSize/MarginV
# by PlayResY/video-height (default PlayResY 288 -> ~2.7x too big, centred).
ffmpeg -y -v error -i $V/kane-loop-demo-draft.mp4 -vf "subtitles=$V/captions.srt:force_style='PlayResX=1366,PlayResY=768,FontName=DejaVu Sans,FontSize=26,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=120'" -c:a copy $V/kane-loop-demo.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 $V/kane-loop-demo.mp4
echo ASSEMBLY DONE
