import { mergeCues, mmss, parseTimestamp, parseVtt, transcriptWithTimes } from './vtt';

const VTT = `WEBVTT
Kind: captions

NOTE this is a comment
with two lines

STYLE
::cue { color: yellow }

1
00:00:01.000 --> 00:00:03.500 align:start position:0%
<v Instructor>Welcome to the <b>Kubernetes</b> lab.</v>

2
00:00:03.500 --> 00:00:06.000
First we install kubectl &amp; minikube.

3
00:00:06.000 --> 00:00:06.000
First we install kubectl &amp; minikube.

00:00:20.000 --> 00:00:24.250
After a long pause: the deployment.

01:02:03,400 --> 01:02:05,000
SRT style comma milliseconds.
`;

describe('WebVTT parsing', () => {
  it('reads timestamps with and without hours, dots or commas', () => {
    expect(parseTimestamp('00:01.500')).toBe(1.5);
    expect(parseTimestamp('01:02:03.4')).toBeCloseTo(3723.4);
    expect(parseTimestamp('01:02:03,400')).toBeCloseTo(3723.4);
    expect(parseTimestamp('nonsense')).toBeNull();
  });

  it('keeps cues only: no NOTE/STYLE blocks, tags stripped, entities decoded, repeated roll-up lines dropped', () => {
    const cues = parseVtt(VTT);
    expect(cues.map((c) => c.text)).toEqual(['Welcome to the Kubernetes lab.', 'First we install kubectl & minikube.', 'After a long pause: the deployment.', 'SRT style comma milliseconds.']);
    expect(cues[0]).toMatchObject({ start: 1, end: 3.5 });
    expect(cues[3].start).toBeCloseTo(3723.4);
  });

  it('tolerates Windows line endings and a byte-order mark', () => {
    expect(parseVtt('﻿WEBVTT\r\n\r\n00:00.000 --> 00:02.000\r\nHello\r\n').map((c) => c.text)).toEqual(['Hello']);
  });
});

describe('merging cues into searchable passages', () => {
  it('joins consecutive cues up to ~15 s, starts a new passage after a pause', () => {
    const segs = mergeCues(parseVtt(VTT));
    expect(segs[0]).toEqual({ seq: 0, start: 1, end: 6, text: 'Welcome to the Kubernetes lab. First we install kubectl & minikube.' });
    expect(segs[1]).toMatchObject({ seq: 1, start: 20, text: 'After a long pause: the deployment.' });
    expect(segs).toHaveLength(3);
  });

  it('caps a passage by length and by duration', () => {
    const cues = Array.from({ length: 20 }, (_, i) => ({ start: i * 2, end: i * 2 + 2, text: `word${i} `.repeat(5).trim() }));
    const segs = mergeCues(cues, { maxSec: 10, maxChars: 1000 });
    expect(segs.every((s) => s.end - s.start <= 10)).toBe(true);
    const short = mergeCues(cues, { maxSec: 100, maxChars: 80 });
    expect(short.every((s) => s.text.length <= 80)).toBe(true);
    expect(short.map((s) => s.seq)).toEqual(short.map((_, i) => i));
  });

  it('formats a transcript with [mm:ss] marks and stops at the size limit', () => {
    const t = transcriptWithTimes([{ start: 0, text: 'a' }, { start: 75, text: 'b' }, { start: 3700, text: 'c' }]);
    expect(t.text).toBe('[0:00] a\n[1:15] b\n[1:01:40] c\n');
    expect(transcriptWithTimes([{ start: 0, text: 'x'.repeat(50) }, { start: 1, text: 'y' }], 60).truncated).toBe(true);
    expect(mmss(59.9)).toBe('0:59');
  });
});
