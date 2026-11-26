"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Captions, Gauge, Headphones, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { DATA_MODES, type DataMode } from "@/lib/data-saver";
import { clock } from "@/lib/format";
import { API_URL } from "@/lib/config";

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
  /** Encrypted HLS: the playlist and key come from the API with the session cookie. */
  protectedStream?: boolean;
  /**
   * Element that goes full screen (default: the player itself). The lesson player passes its stage, which stays mounted
   * between lessons, so the next video opens without leaving full screen.
   */
  fullscreenRef?: React.RefObject<HTMLElement | null>;
  /** Previous / next lesson, shown in the control bar (also Shift+P / Shift+N, like YouTube). */
  onPrev?: () => void;
  onNext?: () => void;
  prevTitle?: string;
  nextTitle?: string;
  /** Data saver (lib/data-saver.ts): the settings this video offers, the current one, and the change handler. */
  dataModes?: DataMode[];
  dataMode?: DataMode;
  onDataMode?: (m: DataMode) => void;
  /** Sizes per setting, shown in the menu ("about 12 MB"). */
  dataSizes?: Partial<Record<DataMode, string | null>>;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

/** Custom-control player over native <video>: speed, captions, ±10 s, fullscreen, keyboard shortcuts. */
export const VideoPlayer = forwardRef<PlayerHandle, Props>(function VideoPlayer(
  { src, format, captionsUrl, startAt = 0, autoPlay = false, title, onTime, onPause, onEnded, onError, overlay, protectedStream = false, fullscreenRef, onPrev, onNext, prevTitle, nextTitle, dataModes, dataMode = "auto", onDataMode, dataSizes },
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
  // Captions are OFF until the learner turns them on (AGENTS.md rule 11); their own choice is remembered.
  const [cc, setCc] = useState(false);
  const [full, setFull] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const audioOnly = dataMode === "audio";
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    try {
      const s = Number(localStorage.getItem("del-speed"));
      // Restore the reader's preferred speed after mount (browser-only preference).
      if (SPEEDS.includes(s)) setSpeed(s);
      if (localStorage.getItem("del-cc") === "on") setCc(true);
    } catch { /* storage blocked */ }
  }, []);
  useEffect(() => {
    if (v.current) v.current.playbackRate = speed;
  }, [speed, src]);
  useEffect(() => {
    const el = v.current;
    if (!el || !el.textTracks[0]) return;
    el.textTracks[0].mode = cc ? "showing" : "hidden";
  }, [cc, captionsUrl, src]);
  const toggleCc = useCallback(() => setCc((c) => {
    try { localStorage.setItem("del-cc", c ? "off" : "on"); } catch { /* storage blocked */ }
    return !c;
  }), []);
  const target = useCallback(() => fullscreenRef?.current ?? wrap.current, [fullscreenRef]);
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement && document.fullscreenElement === target());
    f(); // a player that mounts inside a stage that is already full screen (next lesson)
    // ...takes the keyboard focus, so shortcuts keep working after the lesson changed
    if (document.fullscreenElement?.contains(wrap.current)) wrap.current?.focus({ preventScroll: true });
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, [target]);

  // HLS (Mux): Safari plays it natively; elsewhere attach hls.js on demand.
  const isHls = format === "hls" || /\.m3u8(\?|$)/.test(src);
  // Protected streams prefer hls.js (it sends the session cookie only to our API, never to storage); native HLS is the fallback.
  useEffect(() => {
    const el = v.current;
    if (!el || !isHls) return;
    const native = !!el.canPlayType("application/vnd.apple.mpegurl");
    if (native && !protectedStream) return;
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;
    const apiOrigin = new URL(API_URL).origin;
    void import("hls.js").then(({ default: Hls }) => {
      if (destroyed) return;
      if (!Hls.isSupported()) { if (native) el.src = src; return; }
      const h = new Hls({ xhrSetup: (xhr, url) => { xhr.withCredentials = url.startsWith(apiOrigin); } });
      h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) onErrorRef.current?.(); });
      h.loadSource(src);
      h.attachMedia(el);
      hls = h;
    });
    return () => { destroyed = true; hls?.destroy(); };
  }, [src, isHls, protectedStream]);

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
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    const el = target();
    if (el?.requestFullscreen) { void el.requestFullscreen().catch(() => {}); return; }
    // iPhone Safari: only the video element itself can go full screen (native controls there).
    const vid = v.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    vid?.webkitEnterFullscreen?.();
  }, [target]);
  // Controls show on any mouse movement or touch and fade after 2.5 s without one, while the video plays.
  const poke = useCallback(() => {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 2500);
  }, []);
  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  function onKey(e: React.KeyboardEvent) {
    // Lesson shortcuts work wherever focus is inside the player (also on its buttons).
    if (e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "N" || e.key === "n" || e.key === "P" || e.key === "p")) {
      const fn = e.key.toLowerCase() === "n" ? onNext : onPrev;
      if (fn) { e.preventDefault(); fn(); }
      return;
    }
    if ((e.target as HTMLElement).closest("button, input, select")) {
      if (e.key !== " " || (e.target as HTMLElement).tagName === "INPUT") return;
    }
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") { e.preventDefault(); toggle(); }
    else if (k === "arrowleft" || k === "j") { e.preventDefault(); seek(k === "j" ? -10 : -5); }
    else if (k === "arrowright" || k === "l") { e.preventDefault(); seek(k === "l" ? 10 : 5); }
    else if (k === "f") fullscreen();
    else if (k === "m") setMuted((m) => !m);
    else if (k === "c") toggleCc();
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
      onTouchStart={poke}
      onMouseLeave={() => { if (playing) setIdle(true); }}
      onDoubleClick={(e) => {
        // Double-click anywhere on the picture toggles full screen (not on the control bar).
        if ((e.target as HTMLElement).closest("[data-player-controls]")) return;
        fullscreen();
      }}
      onContextMenu={protectedStream ? (e) => e.preventDefault() : undefined}
      data-testid="video-player"
      data-protected={protectedStream ? "true" : undefined}
    >
      <video
        ref={v}
        key={src}
        src={isHls ? undefined : src}
        className="size-full"
        playsInline
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture={protectedStream}
        disableRemotePlayback={protectedStream}
        autoPlay={autoPlay}
        muted={muted}
        crossOrigin={captionsUrl ? "anonymous" : undefined}
        onClick={toggle}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setDur(el.duration || 0);
          el.playbackRate = speed;
          if (el.textTracks[0]) el.textTracks[0].mode = cc ? "showing" : "hidden";
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


      {audioOnly ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-white" data-qa-on-media data-testid="audio-only">
          <div>
            <Headphones className="mx-auto size-10 text-white/80" aria-hidden="true" />
            <p className="mt-2 font-display text-lg font-bold">Audio only</p>
            <p className="text-sm text-white/75">Picture off to save data. Choose Auto under Data saver to see the video.</p>
          </div>
        </div>
      ) : null}

      {overlay}

      <div data-player-controls className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-10 transition-opacity duration-200 [&>*]:pointer-events-auto ${idle && playing ? "opacity-0" : "opacity-100"}`}>
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
          {onPrev || onNext ? (
            <button type="button" className={`${ctl} disabled:opacity-35 disabled:hover:bg-transparent`} onClick={onPrev} disabled={!onPrev}
              aria-label={prevTitle ? `Previous lesson: ${prevTitle}` : "Previous lesson"} title={prevTitle ? `Previous: ${prevTitle} (Shift+P)` : undefined} data-testid="player-prev">
              <SkipBack className="size-[18px]" fill="currentColor" />
            </button>
          ) : null}
          <button type="button" className={ctl} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5" fill="currentColor" />}
          </button>
          {onPrev || onNext ? (
            <button type="button" className={`${ctl} disabled:opacity-35 disabled:hover:bg-transparent`} onClick={onNext} disabled={!onNext}
              aria-label={nextTitle ? `Next lesson: ${nextTitle}` : "Next lesson"} title={nextTitle ? `Next: ${nextTitle} (Shift+N)` : undefined} data-testid="player-next">
              <SkipForward className="size-[18px]" fill="currentColor" />
            </button>
          ) : null}
          <button type="button" className={`${ctl} ${onPrev || onNext ? "max-sm:hidden" : ""}`} onClick={() => seek(-10)} aria-label="Back 10 seconds"><RotateCcw className="size-[18px]" /></button>
          <button type="button" className={`${ctl} ${onPrev || onNext ? "max-sm:hidden" : ""}`} onClick={() => seek(10)} aria-label="Forward 10 seconds"><RotateCw className="size-[18px]" /></button>
          <button type="button" className={ctl} onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
          </button>
          <span className="ml-1 whitespace-nowrap text-xs tabular-nums text-white/85">{clock(t)} / {clock(dur)}</span>
          <span className="ml-auto" />
          <div className="relative">
            <button type="button" className={`${ctl} !w-auto px-2 text-sm font-bold`} onClick={() => { setSpeedOpen((o) => !o); setDataOpen(false); }} aria-haspopup="menu" aria-expanded={speedOpen} aria-label={`Playback speed ${speed}x`}>
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
          {dataModes && dataModes.length > 1 && onDataMode ? (
            <div className="relative">
              <button type="button" className={`${ctl} ${dataMode !== "auto" ? "bg-white/15" : ""}`} onClick={() => { setDataOpen((o) => !o); setSpeedOpen(false); }}
                aria-haspopup="menu" aria-expanded={dataOpen} aria-label={`Data saver: ${DATA_MODES.find((m) => m.value === dataMode)?.label ?? "Auto"}`} data-testid="data-saver">
                <Gauge className="size-[18px]" />
              </button>
              {dataOpen ? (
                <div role="menu" aria-label="Data saver" className="absolute bottom-11 right-0 z-10 w-60 rounded-lg bg-[#141833]/95 p-1 shadow-float">
                  <p className="px-3 pb-1 pt-1.5 text-xs font-bold text-white/70">Data saver</p>
                  {DATA_MODES.filter((m) => dataModes.includes(m.value)).map((m) => (
                    <button key={m.value} role="menuitemradio" aria-checked={m.value === dataMode} type="button"
                      className={`block w-full rounded-md px-3 py-1.5 text-left text-sm ${m.value === dataMode ? "bg-white/15" : "hover:bg-white/10"}`}
                      onClick={() => { setDataOpen(false); if (m.value !== dataMode) onDataMode(m.value); }}>
                      <span className="flex items-baseline justify-between gap-2"><span className={m.value === dataMode ? "font-bold" : ""}>{m.label}</span>{dataSizes?.[m.value] ? <span className="text-xs tabular-nums text-white/70">{dataSizes[m.value]}</span> : null}</span>
                      <span className="block text-xs text-white/70">{m.hint}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {captionsUrl ? (
            <button type="button" className={`${ctl} ${cc ? "bg-white/15" : ""}`} onClick={toggleCc} aria-pressed={cc} aria-label="Captions">
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
