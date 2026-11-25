"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Captions, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { clock } from "@/lib/format";

export interface PlayerHandle {
  video: HTMLVideoElement | null;
}

interface Props {
  src: string;
  format?: "mp4" | "hls";
  captionsUrl?: string | null;
  startAt?: number;
  autoPlay?: boolean;
  title?: string;
  onTime?: (t: number, duration: number) => void;
  onPause?: (t: number) => void;
  onEnded?: (t: number) => void;
  onError?: () => void;
  overlay?: React.ReactNode;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

/** Custom-control player over native <video>: speed, captions, ±10 s, fullscreen, keyboard shortcuts. */
export const VideoPlayer = forwardRef<PlayerHandle, Props>(function VideoPlayer(
  { src, format, captionsUrl, startAt = 0, autoPlay = false, title, onTime, onPause, onEnded, onError, overlay },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const v = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => ({ video: v.current }), []);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  // Captions are off until the learner turns them on (owner rule); their choice is remembered in this browser.
  const [cc, setCcState] = useState(false);
  const setCc = (next: (c: boolean) => boolean) =>
    setCcState((c) => {
      const v = next(c);
      try { localStorage.setItem("del-captions", v ? "on" : "off"); } catch { /* storage blocked */ }
      return v;
    });
  const [full, setFull] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const s = Number(localStorage.getItem("del-speed"));
      // Restore the reader's preferred speed after mount (browser-only preference).
      if (SPEEDS.includes(s)) setSpeed(s);
      if (localStorage.getItem("del-captions") === "on") setCcState(true);
    } catch { /* storage blocked */ }
  }, []);
  useEffect(() => {
    if (v.current) v.current.playbackRate = speed;
  }, [speed, src]);
  useEffect(() => {
    const el = v.current;
    const track = el?.textTracks[0];
    if (!track) return;
    track.mode = cc ? "showing" : "hidden";
    // Keep cues above the control bar instead of under it.
    const lift = () => { for (const cue of Array.from(track.cues ?? [])) if ("line" in cue) (cue as VTTCue).line = -4; };
    lift();
    el.querySelector("track")?.addEventListener("load", lift);
    return () => el.querySelector("track")?.removeEventListener("load", lift);
  }, [cc, captionsUrl, src]);
  useEffect(() => {
    const f = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  // HLS (Mux): Safari plays it natively; elsewhere attach hls.js on demand.
  const isHls = format === "hls" || /\.m3u8(\?|$)/.test(src);
  useEffect(() => {
    const el = v.current;
    if (!el || !isHls || el.canPlayType("application/vnd.apple.mpegurl")) return;
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;
    void import("hls.js").then(({ default: Hls }) => {
      if (destroyed || !Hls.isSupported()) return;
      const h = new Hls();
      h.loadSource(src);
      h.attachMedia(el);
      hls = h;
    });
    return () => { destroyed = true; hls?.destroy(); };
  }, [src, isHls]);

  const toggle = useCallback(() => {
    const el = v.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  }, []);
  const seek = useCallback((d: number) => {
    const el = v.current;
    if (el) el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + d));
  }, []);
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.current?.requestFullscreen?.();
  }, []);
  const poke = () => {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 2500);
  };

  function onKey(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest("button, input, select")) {
      if (e.key !== " " || (e.target as HTMLElement).tagName === "INPUT") return;
    }
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") { e.preventDefault(); toggle(); }
    else if (k === "arrowleft" || k === "j") { e.preventDefault(); seek(k === "j" ? -10 : -5); }
    else if (k === "arrowright" || k === "l") { e.preventDefault(); seek(k === "l" ? 10 : 5); }
    else if (k === "f") fullscreen();
    else if (k === "m") setMuted((m) => !m);
    else if (k === "c") setCc((c) => !c);
    poke();
  }

  const pct = dur ? (t / dur) * 100 : 0;
  const ctl = "grid size-9 place-items-center rounded-lg text-white/90 hover:bg-white/15 hover:text-white";
  return (
    <div
      ref={wrap}
      className={`group/player relative aspect-video w-full overflow-hidden bg-black ${full ? "" : "rounded-tile"} ${idle && playing ? "cursor-none" : ""}`}
      tabIndex={0}
      role="region"
      aria-label={title ? `Video player: ${title}` : "Video player"}
      onKeyDown={onKey}
      onMouseMove={poke}
      data-testid="video-player"
    >
      <video
        ref={v}
        key={src}
        src={isHls ? undefined : src}
        className="size-full"
        playsInline
        autoPlay={autoPlay}
        muted={muted}
        crossOrigin={captionsUrl ? "anonymous" : undefined}
        onClick={toggle}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setDur(el.duration || 0);
          el.playbackRate = speed;
          if (startAt > 0 && startAt < (el.duration || Infinity) - 2) el.currentTime = startAt;
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setT(el.currentTime);
          onTime?.(el.currentTime, el.duration || 0);
        }}
        onPlay={() => { setPlaying(true); poke(); }}
        onPause={(e) => { setPlaying(false); setIdle(false); onPause?.(e.currentTarget.currentTime); }}
        onEnded={(e) => { setPlaying(false); onEnded?.(e.currentTarget.currentTime); }}
        onError={() => onError?.()}
      >
        {captionsUrl ? <track kind="captions" src={captionsUrl} srcLang="en" label="English" /> : null}
      </video>

      {!playing && t === 0 ? (
        <button type="button" onClick={toggle} className="absolute inset-0 grid place-items-center bg-black/25" aria-label="Play video">
          <span className="grid size-20 place-items-center rounded-full bg-white/95 text-[#141833] shadow-float transition-transform hover:scale-105">
            <Play className="ml-1 size-8" fill="currentColor" />
          </span>
        </button>
      ) : null}

      {overlay}

      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-10 transition-opacity duration-200 ${idle && playing ? "opacity-0" : "opacity-100"}`}>
        <input
          type="range"
          min={0}
          max={dur || 0}
          step={0.1}
          value={t}
          aria-label="Seek"
          aria-valuetext={`${clock(t)} of ${clock(dur)}`}
          onChange={(e) => { if (v.current) v.current.currentTime = Number(e.target.value); }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#58c3f2]"
          style={{ background: `linear-gradient(90deg,#58c3f2 ${pct}%,rgba(255,255,255,.3) ${pct}%)` }}
        />
        <div className="mt-1.5 flex items-center gap-1 text-white">
          <button type="button" className={ctl} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5" fill="currentColor" />}
          </button>
          <button type="button" className={ctl} onClick={() => seek(-10)} aria-label="Back 10 seconds"><RotateCcw className="size-[18px]" /></button>
          <button type="button" className={ctl} onClick={() => seek(10)} aria-label="Forward 10 seconds"><RotateCw className="size-[18px]" /></button>
          <button type="button" className={ctl} onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
          </button>
          <span className="ml-1 text-xs tabular-nums text-white/85">{clock(t)} / {clock(dur)}</span>
          <span className="ml-auto" />
          <div className="relative">
            <button type="button" className={`${ctl} !w-auto px-2 text-sm font-bold`} onClick={() => setSpeedOpen((o) => !o)} aria-haspopup="menu" aria-expanded={speedOpen} aria-label={`Playback speed ${speed}x`}>
              {speed}×
            </button>
            {speedOpen ? (
              <div role="menu" className="absolute bottom-11 right-0 z-10 w-28 rounded-lg bg-[#141833]/95 p-1 shadow-float">
                {SPEEDS.map((s) => (
                  <button key={s} role="menuitemradio" aria-checked={s === speed} type="button"
                    className={`block w-full rounded-md px-3 py-1.5 text-left text-sm ${s === speed ? "bg-white/15 font-bold" : "hover:bg-white/10"}`}
                    onClick={() => { setSpeed(s); setSpeedOpen(false); try { localStorage.setItem("del-speed", String(s)); } catch { /* ignore */ } }}>
                    {s}×{s === 1 ? " normal" : ""}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {captionsUrl ? (
            <button type="button" className={`${ctl} ${cc ? "bg-white/15" : ""}`} onClick={() => setCc((c) => !c)} aria-pressed={cc} aria-label="Captions">
              <Captions className="size-5" />
            </button>
          ) : null}
          <button type="button" className={ctl} onClick={fullscreen} aria-label={full ? "Exit full screen" : "Full screen"}>
            {full ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  );
});
