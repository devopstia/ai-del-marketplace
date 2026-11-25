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

export interface Packaged { prefix: string; playlist: string; keyWrapped: string; ivHex: string; segments: number }
export class UnsupportedVideo extends Error {}

/** Codecs that go into MPEG-TS segments without re-encoding. */
async function probe(url: string) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name', '-of', 'json', url], { timeout: 120_000 });
  const streams = (JSON.parse(stdout).streams ?? []) as { codec_type: string; codec_name: string }[];
  return { video: streams.find((s) => s.codec_type === 'video')?.codec_name, audio: streams.find((s) => s.codec_type === 'audio')?.codec_name };
}

/**
 * Turns one source video into encrypted HLS: ffmpeg cuts segments (copy, or re-encode to 2 s keyframes when HLS_REENCODE),
 * each segment is encrypted here with AES-128-CBC (the key never touches disk), uploaded under a random prefix, and the
 * playlist is returned with placeholders for the key URI and segment URLs. The original file is not touched.
 */
export async function packageHls(sourceUrl: string, upload: (key: string, body: Buffer) => Promise<void>): Promise<Packaged> {
  const e = env();
  const { video, audio } = await probe(sourceUrl);
  const reencode = e.HLS_REENCODE;
  if (!reencode && (video !== 'h264' || (audio && !['aac', 'mp3'].includes(audio)))) {
    throw new UnsupportedVideo(`video ${video ?? 'none'} / audio ${audio ?? 'none'} can't be packaged without re-encoding (set HLS_REENCODE=true)`);
  }
  const dir = await mkdtemp(join(tmpdir(), 'hls-'));
  try {
    const codec = reencode
      ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-c:a', 'aac', '-b:a', '128k']
      : ['-c', 'copy', '-bsf:v', 'h264_mp4toannexb'];
    await run('nice', ['-n', '10', 'ffmpeg', '-v', 'error', '-i', sourceUrl, '-map', '0:v:0', '-map', '0:a:0?', ...codec,
      '-f', 'hls', '-hls_time', String(reencode ? 2 : e.HLS_SEGMENT_SECONDS), '-hls_playlist_type', 'vod', '-hls_segment_filename', join(dir, 'seg_%05d.ts'), join(dir, 'index.m3u8')],
      { timeout: 3 * 3600_000, maxBuffer: 16 * 1024 * 1024 });
    const key = randomBytes(16);
    const iv = randomBytes(16);
    const prefix = randomBytes(16).toString('hex');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.ts')).sort();
    for (const f of files) {
      const p = join(dir, f);
      await upload(`hls/${prefix}/${f}`, encryptSegment(await readFile(p), key, iv));
      await rm(p);
    }
    const ivHex = iv.toString('hex');
    const lines = (await readFile(join(dir, 'index.m3u8'), 'utf8')).split('\n');
    const out: string[] = [];
    let keyed = false;
    for (const l of lines) {
      if (!keyed && l.startsWith('#EXTINF')) { out.push(`#EXT-X-KEY:METHOD=AES-128,URI="${KEY_PLACEHOLDER}",IV=0x${ivHex}`); keyed = true; }
      out.push(/^seg_\d+\.ts$/.test(l.trim()) ? segPlaceholder(l.trim()) : l);
    }
    return { prefix, playlist: out.join('\n'), keyWrapped: wrapKey(key), ivHex, segments: files.length };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
