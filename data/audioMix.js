// ── Audio mix ── one finished soundtrack for a reel: voiceover clips placed at
// their scene offsets, a music bed under them with sidechain DUCKING (the music
// dips automatically whenever the voice speaks), gentle EQ on the music, and
// loudness normalised for social (-14 LUFS, -1.5 dBTP). Output: stereo WAV of
// exactly `total` seconds, muxed by the motion renderer.
import fs from "node:fs";
import { spawn } from "node:child_process";

async function ffmpegBin() {
  const m = await import("ffmpeg-static"); const p = m.default || m;
  if (!p || !fs.existsSync(p)) throw new Error("ffmpeg binary not found"); return p;
}
function run(bin, args) {
  return new Promise((res, rej) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] }); let err = "";
    p.stderr.on("data", (d) => { err += d; if (err.length > 6000) err = err.slice(-6000); });
    p.on("error", rej); p.on("close", (c) => c === 0 ? res() : rej(new Error(`ffmpeg mix exited ${c}: ${err.slice(-500)}`)));
  });
}
// voClips: [{ path, at }]  (at = seconds from reel start)
// musicPath: WAV/MP3 (looped if shorter) or null. Returns out (or null if no audio).
export async function mixAudio({ total, voClips = [], musicPath = null, out, musicVolume = 0.5 }) {
  const vos = voClips.filter((v) => v && v.path && fs.existsSync(v.path));
  const hasMusic = !!(musicPath && fs.existsSync(musicPath));
  if (!vos.length && !hasMusic) return null;
  const T = (+total).toFixed(3), args = ["-y"], f = [];
  let idx = 0, musIdx = -1;
  if (hasMusic) { args.push("-stream_loop", "-1", "-i", musicPath); musIdx = idx++; }
  const voIdx = vos.map((v) => { args.push("-i", v.path); return idx++; });
  if (hasMusic) f.push(`[${musIdx}:a]aresample=44100,aformat=channel_layouts=stereo,highpass=f=40,lowpass=f=9500,volume=${musicVolume},atrim=0:${T},afade=t=out:st=${Math.max(0, total - 1.4).toFixed(2)}:d=1.4[mus]`);
  voIdx.forEach((ix, k) => {
    const ms = Math.max(0, Math.round(vos[k].at * 1000));
    f.push(`[${ix}:a]aresample=44100,pan=stereo|c0=c0|c1=c0,highpass=f=70,loudnorm=I=-15:TP=-2:LRA=7,afade=t=in:st=0:d=0.015,areverse,afade=t=in:st=0:d=0.03,areverse,adelay=${ms}|${ms}[v${k}]`);
  });
  if (vos.length) f.push(`${vos.map((_, k) => `[v${k}]`).join("")}amix=inputs=${vos.length}:normalize=0:duration=longest,apad=whole_dur=${T}[vo]`);
  if (vos.length && hasMusic) {
    f.push(`[vo]asplit=2[vok][vosc]`);
    f.push(`[mus][vosc]sidechaincompress=threshold=0.012:ratio=12:attack=12:release=420:makeup=1[duck]`);
    f.push(`[duck][vok]amix=inputs=2:normalize=0:duration=first[mix]`);
  }
  const src = vos.length && hasMusic ? "[mix]" : vos.length ? "[vo]" : "[mus]";
  f.push(`${src}loudnorm=I=-14:TP=-2.0:LRA=11,alimiter=limit=0.79:level=false,atrim=0:${T}[out]`);
  args.push("-filter_complex", f.join(";"), "-map", "[out]", "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", out);
  await run(await ffmpegBin(), args);
  return out;
}
