// Reel engine — turns generated brand frames into a real publishable MP4 reel
// (9:16, H.264 + silent AAC) using the bundled ffmpeg. This is what makes
// "regenerate a reel" produce an actual NEW video instead of keeping the old
// footage: scenes come from CAIMO (hook → value → CTA), each is rendered by the
// design engine in the professional brand style, then stitched.
//
// MEMORY-LEAN by design: Railway's container OOM-killed the first xfade-based
// pipeline ("ffmpeg exited null" = SIGKILL). So we use the concat demuxer (one
// decoder, hard cuts) + a whole-video fade in/out, single-thread ultrafast
// x264 with no lookahead. If the encoder still gets killed, we retry once at
// 720x1280 (Instagram accepts it and upscales).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { renderReelFrame } from "./designEngine.js";

const SCENE_SEC = 3.2, FADE_SEC = 0.5;

async function ffmpegPath() {
  const m = await import("ffmpeg-static");
  const p = m.default || m;
  if (!p || !fs.existsSync(p)) throw new Error("ffmpeg binary not found");
  return p;
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d; if (err.length > 8000) err = err.slice(-8000); });
    p.on("error", reject);
    p.on("close", (code, signal) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code ?? `signal ${signal}`}: ${err.slice(-400)}`)));
  });
}

function encodeArgs(listFile, total, scaleDown, outPath) {
  const fades = `fade=t=in:st=0:d=${FADE_SEC},fade=t=out:st=${(total - FADE_SEC).toFixed(2)}:d=${FADE_SEC}`;
  const vf = `${scaleDown ? "scale=720:1280," : ""}fps=25,format=yuv420p,${fades}`;
  return [
    "-y",
    "-f", "concat", "-safe", "0", "-i", listFile,
    "-f", "lavfi", "-t", String(total), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-vf", vf,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-threads", "1",
    "-x264-params", "ref=1:bframes=0:rc-lookahead=0:keyint=50",
    "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart",
    outPath
  ];
}

// Serialize renders — two concurrent encodes would double peak memory.
let busy = false;

// scenes: [{kind, headline, body, kicker}, ...] (2-4). Writes outPath (.mp4).
export async function renderReel(scenes, outPath) {
  if (!Array.isArray(scenes) || scenes.length < 2) throw new Error("need at least 2 scenes");
  if (busy) throw new Error("reel engine busy — try again in a minute");
  busy = true;
  scenes = scenes.slice(0, 4);
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, `.frames-${path.basename(outPath, ".mp4")}`);
  const frames = [], listFile = `${base}.txt`;
  try {
    const bin = await ffmpegPath();
    for (let i = 0; i < scenes.length; i++) {
      const f = `${base}-${i}.png`;
      fs.writeFileSync(f, await renderReelFrame(scenes[i]));
      frames.push(f);
    }
    const total = scenes.length * SCENE_SEC;
    // concat demuxer playlist (last entry repeated, per the demuxer's spec)
    const lines = frames.map((f) => `file '${f}'\nduration ${SCENE_SEC}`);
    lines.push(`file '${frames[frames.length - 1]}'`);
    fs.writeFileSync(listFile, lines.join("\n"));
    try {
      await run(bin, encodeArgs(listFile, total, false, outPath)); // 1080x1920
    } catch (e) {
      console.error("[reel] 1080p encode failed, retrying at 720p:", e.message);
      await run(bin, encodeArgs(listFile, total, true, outPath)); // 720x1280 fallback
    }
    // fsync so the reel survives a Railway redeploy (Volume-backed like designs)
    const fd = fs.openSync(outPath, "r+"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return outPath;
  } finally {
    busy = false;
    for (const f of [...frames, listFile]) { try { fs.unlinkSync(f); } catch (e) {} }
  }
}
