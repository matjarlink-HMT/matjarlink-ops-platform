// Reel engine v3 — turns generated brand frames into a real publishable MP4
// reel (1080x1920, H.264 + silent AAC) with Ken Burns motion, using the
// bundled ffmpeg. Scenes come from CAIMO (hook → value → CTA), each rendered
// by the design engine in the professional brand style.
//
// ARCHITECTURE (measured, not guessed): the v2 concat-demuxer pipeline peaked
// at 557MB — the fps=25 filter exploded each single still into 240 queued
// frames (this, not xfade, was the Railway OOM). v3 encodes EACH SCENE as its
// own segment through zoompan (a lazy frame generator: ~54MB peak, and free
// Ken Burns motion), then merges segments losslessly with concat -c copy
// (~19MB). Sequential segments mean the single-segment peak IS the total peak.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { renderReelFrame } from "./designEngine.js";

// Scene pacing by role: tight hook, readable body, confident close (~8.4s total).
const SEC = { hook: 2.4, body: 3.2, cta: 2.8 };
const FPS = 25, FLASH = 0.25; // white-flash cut between scenes (on-brand: white canvas)

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

// Ken Burns variation per scene index: in → out → drift-up → in.
function zoomExpr(i, frames) {
  const d = frames - 1;
  if (i % 3 === 0) return { z: `1+0.06*on/${d}`, x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" };
  if (i % 3 === 1) return { z: `1.06-0.06*on/${d}`, x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" };
  return { z: "1.05", x: "iw/2-(iw/zoom/2)", y: `(ih-ih/zoom)*on/${d}` };
}

function segArgs(framePng, i, n, sec, outSeg) {
  const frames = Math.round(sec * FPS);
  const { z, x, y } = zoomExpr(i, frames);
  // upscale before zoompan to kill its integer-origin jitter (measured +10MB)
  let vf = `scale=2160:3840,zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=1080x1920:fps=${FPS}`;
  if (i === 0) vf += `,fade=t=in:st=0:d=0.4`;
  if (i < n - 1) vf += `,fade=t=out:st=${(sec - FLASH).toFixed(2)}:d=${FLASH}:c=white`; // white-flash into next
  else vf += `,fade=t=out:st=${(sec - 0.4).toFixed(2)}:d=0.4`;
  if (i > 0) vf += `,fade=t=in:st=0:d=${FLASH}:c=white`;
  vf += `,format=yuv420p`; // LAST — colored fades force RGB and would leak yuv444p (IG rejects it)
  return [
    "-y", "-i", framePng, "-vf", vf,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-threads", "1",
    "-x264-params", "ref=1:bframes=0:rc-lookahead=0:keyint=50",
    "-an", outSeg
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
  const base = path.join(dir, `.seg-${path.basename(outPath, ".mp4")}`);
  const tmp = [];
  try {
    const bin = await ffmpegPath();
    const n = scenes.length, segs = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const sec = SEC[scenes[i].kind] || 3.0; total += sec;
      const png = `${base}-${i}.png`, seg = `${base}-${i}.mp4`;
      fs.writeFileSync(png, await renderReelFrame(scenes[i]));
      tmp.push(png, seg);
      await run(bin, segArgs(png, i, n, sec, seg)); // sequential: one encoder at a time
      segs.push(seg);
    }
    // lossless merge + silent stereo AAC (some IG checks want an audio track)
    const listFile = `${base}.txt`; tmp.push(listFile);
    fs.writeFileSync(listFile, segs.map((s) => `file '${s}'`).join("\n"));
    await run(bin, [
      "-y", "-f", "concat", "-safe", "0", "-i", listFile,
      "-f", "lavfi", "-t", total.toFixed(2), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart",
      outPath
    ]);
    // fsync so the reel survives a Railway redeploy (Volume-backed like designs)
    const fd = fs.openSync(outPath, "r+"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return outPath;
  } finally {
    busy = false;
    for (const f of tmp) { try { fs.unlinkSync(f); } catch (e) {} }
  }
}
