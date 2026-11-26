import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { env } from '../config/env';
import { encryptSegment, wrapKey } from './media-keys';

const run = promisify(execFile);
export const KEY_PLACEHOLDER = '{{KEY_URI}}';
export const segPlaceholder = (name: string) => `{{SEG:${name}}}`;

export interface Variant { name: string; height: number; width: number; bandwidth: number; playlist: string }
export interface Packaged { prefix: string; playlist: string; keyWrapped: string; ivHex: string; segments: number; variants: Variant[] }
export class UnsupportedVideo extends Error {}

/** Codecs that go into MPEG-TS segments without re-encoding, and the picture size. */
async function probe(url: string) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height:format=duration', '-of', 'json', url], { timeout: 120_000 });
  const j = JSON.parse(stdout) as { streams?: { codec_type: string; codec_name: string; width?: number; height?: number }[]; format?: { duration?: string } };
  const streams = j.streams ?? [];
  const v = streams.find((s) => s.codec_type === 'video');
  return { video: v?.codec_name, width: v?.width ?? 0, height: v?.height ?? 0, audio: streams.find((s) => s.codec_type === 'audio')?.codec_name, duration: Number(j.format?.duration ?? 0) };
}

/** Lower qualities to add below the source (owner 2026-11-26: smooth playback on slow connections). */
export function renditionHeights(sourceHeight: number, configured = env().HLS_RENDITIONS): number[] {
  return configured.split(',').map((x) => Number(x.trim())).filter((h) => Number.isInteger(h) && h >= 144 && h < sourceHeight - 32).sort((a, b) => b - a);
}
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
/** Bit-rate ceilings for the added qualities (H.264, kbit/s): keeps a 480p hour around 0.5 GB. */
const MAXRATE: Record<number, number> = { 1080: 5000, 720: 2800, 540: 1800, 480: 1200, 360: 800, 240: 450 };

async function cut(sourceUrl: string, dir: string, args: string[], segSeconds: number) {
  await run('nice', ['-n', '10', 'ffmpeg', '-v', 'error', '-i', sourceUrl, '-map', '0:v:0', '-map', '0:a:0?', ...args,
    '-f', 'hls', '-hls_time', String(segSeconds), '-hls_playlist_type', 'vod', '-hls_segment_filename', join(dir, 'seg_%05d.ts'), join(dir, 'index.m3u8')],
  { timeout: 3 * 3600_000, maxBuffer: 16 * 1024 * 1024 });
}

/**
 * Turns one source video into encrypted multi-quality HLS: the original quality (copied when it is already H.264, else
 * re-encoded) plus lower qualities (HLS_RENDITIONS, default 720p and 480p) so players switch to what the connection can
 * carry. Every segment is encrypted here with AES-128-CBC (one key per video; it never touches disk) and uploaded under a
 * random prefix; playlists are returned with placeholders for the key URI and segment URLs. The original is not touched.
 */
export async function packageHls(sourceUrl: string, upload: (key: string, body: Buffer) => Promise<void>): Promise<Packaged> {
  const e = env();
  const src = await probe(sourceUrl);
  const reencode = e.HLS_REENCODE;
  const copyable = src.video === 'h264' && (!src.audio || ['aac', 'mp3'].includes(src.audio));
  if (!reencode && !copyable) {
    throw new UnsupportedVideo(`video ${src.video ?? 'none'} / audio ${src.audio ?? 'none'} can't be packaged without re-encoding (set HLS_REENCODE=true)`);
  }
  const key = randomBytes(16);
  const iv = randomBytes(16);
  const ivHex = iv.toString('hex');
  const prefix = randomBytes(16).toString('hex');
  const seg = e.HLS_SEGMENT_SECONDS;
  const aspect = src.width && src.height ? src.width / src.height : 16 / 9;
  // the source quality first, then the lower ones; every added quality has a keyframe at each segment boundary
  const plans: { name: string; height: number; width: number; args: string[]; segSeconds: number }[] = [{
    name: 'source', height: src.height, width: src.width,
    args: reencode ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-c:a', 'aac', '-b:a', '128k'] : ['-c', 'copy', '-bsf:v', 'h264_mp4toannexb'],
    segSeconds: reencode ? 2 : seg,
  }];
  for (const h of renditionHeights(src.height)) {
    const rate = MAXRATE[h] ?? Math.round(h * 2.6);
    plans.push({
      name: `${h}p`, height: h, width: even(h * aspect),
      args: ['-vf', `scale=-2:${h}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-maxrate', `${rate}k`, '-bufsize', `${rate * 2}k`,
        '-force_key_frames', `expr:gte(t,n_forced*${seg})`, '-sc_threshold', '0', '-c:a', 'aac', '-b:a', h >= 720 ? '128k' : '96k', '-ac', '2'],
      segSeconds: seg,
    });
  }
  const variants: Variant[] = [];
  let segments = 0;
  for (const plan of plans) {
    const dir = await mkdtemp(join(tmpdir(), 'hls-'));
    try {
      await cut(sourceUrl, dir, plan.args, plan.segSeconds);
      const files = (await readdir(dir)).filter((f) => f.endsWith('.ts')).sort();
      let bytes = 0;
      for (const f of files) {
        const p = join(dir, f);
        const body = encryptSegment(await readFile(p), key, iv);
        bytes += body.length;
        // the source quality keeps the old flat layout (hls/<prefix>/seg_…), so older players and playlists still work
        await upload(plan.name === 'source' ? `hls/${prefix}/${f}` : `hls/${prefix}/${plan.name}/${f}`, body);
        await rm(p);
      }
      segments += files.length;
      const lines = (await readFile(join(dir, 'index.m3u8'), 'utf8')).split('\n');
      const out: string[] = [];
      let keyed = false;
      for (const l of lines) {
        if (!keyed && l.startsWith('#EXTINF')) { out.push(`#EXT-X-KEY:METHOD=AES-128,URI="${KEY_PLACEHOLDER}",IV=0x${ivHex}`); keyed = true; }
        const m = /^seg_\d+\.ts$/.exec(l.trim());
        out.push(m ? segPlaceholder(plan.name === 'source' ? l.trim() : `${plan.name}/${l.trim()}`) : l);
      }
      // peak estimate for the master playlist: average rate + 25%
      const bandwidth = src.duration > 0 ? Math.round(((bytes * 8) / src.duration) * 1.25) : 0;
      variants.push({ name: plan.name, height: plan.height, width: plan.width, bandwidth, playlist: out.join('\n') });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  return { prefix, playlist: variants[0]!.playlist, keyWrapped: wrapKey(key), ivHex, segments, variants };
}
