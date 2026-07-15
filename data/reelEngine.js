// Reel engine — turns generated brand frames into a real publishable MP4 reel
// (1080x1920, H.264 + silent AAC, fade transitions) using the bundled ffmpeg.
// This is what makes "regenerate a reel" produce an actual NEW video instead of
// keeping the old footage: scenes come from CAIMO (hook → value → CTA), each is
// rendered by the design engine in the professional brand style, then stitched.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { renderReelFrame } from "./designEngine.js";

const SCENE_SEC = 3.5, FADE_SEC = 0.6;

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
    p.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-600)}`)));
  });
}

// scenes: [{kind, headline, body, kicker}, ...] (2-4). Writes outPath (.mp4).
export async function renderReel(scenes, outPath) {
  if (!Array.isArray(scenes) || scenes.length < 2) throw new Error("need at least 2 scenes");
  scenes = scenes.slice(0, 4);
  const bin = await ffmpegPath();
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, `.frames-${path.basename(outPath, ".mp4")}`);
  const frames = [];
  try {
    for (let i = 0; i < scenes.length; i++) {
      const f = `${base}-${i}.png`;
      fs.writeFileSync(f, await renderReelFrame(scenes[i]));
      frames.push(f);
    }
    const n = frames.length;
    const total = n * SCENE_SEC - (n - 1) * FADE_SEC;
    const args = ["-y"];
    for (const f of frames) args.push("-loop", "1", "-t", String(SCENE_SEC), "-i", f);
    args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
    // chain xfades: [0][1]xfade[v1]; [v1][2]xfade[v2]; ...
    let fc = "", prev = "0:v";
    for (let k = 1; k < n; k++) {
      const outLbl = k === n - 1 ? "vx" : `v${k}`;
      fc += `[${prev}][${k}:v]xfade=transition=fade:duration=${FADE_SEC}:offset=${(k * (SCENE_SEC - FADE_SEC)).toFixed(2)}[${outLbl}];`;
      prev = outLbl;
    }
    fc += `[${prev}]format=yuv420p[v]`;
    args.push(
      "-filter_complex", fc, "-map", "[v]", "-map", `${n}:a`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-r", "30",
      "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
      outPath
    );
    await run(bin, args);
    // fsync so the reel survives a Railway redeploy (Volume-backed like designs)
    const fd = fs.openSync(outPath, "r+"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return outPath;
  } finally {
    for (const f of frames) { try { fs.unlinkSync(f); } catch (e) {} }
  }
}
