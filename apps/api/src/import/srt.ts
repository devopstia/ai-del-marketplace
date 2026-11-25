/** SubRip (.srt) → WebVTT (.vtt): header, "," → "." in timestamps, cue numbers kept as cue ids. */
export function srtToVtt(srt: string): string {
  const text = srt.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!text) return 'WEBVTT\n';
  const blocks = text.split(/\n{2,}/);
  const cues: string[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx < 0) continue;
    const id = timeIdx > 0 ? lines.slice(0, timeIdx).join(' ').trim() : '';
    const time = lines[timeIdx].replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2').trim();
    if (!/^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/.test(time)) continue;
    const body = lines.slice(timeIdx + 1).filter((l) => l.trim() !== '').map((l) => l.replace(/-->/g, '→'));
    cues.push([id, time, ...body].filter(Boolean).join('\n'));
  }
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}
