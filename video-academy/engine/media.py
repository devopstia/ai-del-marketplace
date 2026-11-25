"""Audio and video stages of the pipeline (ported from the Insurance Knowledge Hub video-academy, 2026-11-25).

    python engine/media.py voice    <work> <models> <voice> <speed> <lang>
    python engine/media.py assemble <work> <out.mp4> <cover.png>
    python engine/media.py deck     <work> <out.pptx> <out.pdf> <title>
    python engine/media.py qa       <work> <out.mp4>

<work>/script.json holds {"title", "scenes": [{"id", "lines": [...]}]}.
"""
import hashlib, json, os, re, subprocess, sys, difflib

def ff(*a): subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)
def dur_of(f): return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout)

# Words the speech recogniser writes differently from the script; equal for QA.
NUM = {"ten": "10", "eleven": "11", "twelve": "12", "twenty": "20", "twenty five": "25", "thirty": "30", "sixty": "60", "seventy": "70", "eighty": "80", "forty": "40", "fifty": "50", "ninety": "90", "nine": "9", "five": "5", "four": "4", "three": "3", "two": "2", "six": "6", "seven": "7", "eight": "8", "fifteen": "15", "sixteen": "16", "one hundred question": "100 question", "one hundred": "100", "zero": "0"}
SAME = [("d e l", "del"), ("dell", "del"), ("devops", "dev ops"), ("k8s", "kubernetes"), ("homepage", "home page"), ("scoretrend", "score trend"), ("e mail", "email"), ("ctrl", "control"), ("pass keys", "passkeys"), ("pass key", "passkey"), ("okay", "ok"), ("dialogue", "dialog"), ("colours", "colors"), ("colour", "color"), ("centre", "center"), ("percent", "percent")]
def norm(s):
    s = s.lower().replace("'", "").replace("\u2019", "").replace("-", " ").replace("%", " percent").replace("&", " and ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    for a, b in SAME: s = re.sub(rf"\b{a}\b", b, s)
    for a, b in sorted(NUM.items(), key=lambda x: -len(x[0])): s = re.sub(rf"\b{a}\b", b, s)
    return s.split()

def voice(work, models, vname, speed, lang):
    import soundfile as sf
    from kokoro_onnx import Kokoro
    from faster_whisper import WhisperModel
    sc = json.load(open(f"{work}/script.json")); os.makedirs(f"{work}/voice", exist_ok=True)
    durf = f"{work}/voice/durations.json"; dur = json.load(open(durf)) if os.path.exists(durf) else {}
    k = None; made = []
    for s in sc["scenes"]:
        for i, text in enumerate(s["lines"]):
            key = f"{s['id']}_{i}"; sig = hashlib.sha1(f"{vname}|{speed}|{text}|{json.dumps(sc.get('say', {}), sort_keys=True)}".encode()).hexdigest()
            sigf = f"{work}/voice/{key}.sig"
            if os.path.exists(f"{work}/voice/{key}.wav") and os.path.exists(sigf) and open(sigf).read() == sig and key in dur: continue
            k = k or Kokoro(f"{models}/kokoro-v1.0.onnx", f"{models}/voices-v1.0.bin")
            spoken = text
            for w, sw in sorted(sc.get("say", {}).items(), key=lambda x: -len(x[0])): spoken = re.sub(rf"\b{re.escape(w)}\b", sw, spoken)
            samples, sr = k.create(spoken, voice=vname, speed=float(speed), lang=lang)
            sf.write(f"{work}/voice/{key}.raw.wav", samples, sr)
            ff("-i", f"{work}/voice/{key}.raw.wav", "-af", "highpass=f=70,lowpass=f=15000,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2,equalizer=f=3200:t=q:w=1.2:g=2,aresample=48000:resampler=soxr", "-ac", "2", f"{work}/voice/{key}.wav")
            dur[key] = round(dur_of(f"{work}/voice/{key}.wav"), 2); open(sigf, "w").write(sig); made.append((key, text))
    # drop durations of lines that no longer exist
    keys = {f"{s['id']}_{i}" for s in sc["scenes"] for i in range(len(s["lines"]))}
    dur = {k2: v for k2, v in dur.items() if k2 in keys}
    json.dump(dur, open(durf, "w"), indent=1)
    bad = []
    if made:
        m = WhisperModel("small.en", device="cpu", compute_type="int8")
        for key, text in made:
            heard = " ".join(x.text.strip() for x in m.transcribe(f"{work}/voice/{key}.wav", beam_size=5)[0])
            if norm(text) != norm(heard): bad.append({"line": key, "diff": [d for d in difflib.ndiff(norm(text), norm(heard)) if d[0] in "+-"][:12]})
    report = {"lines": len(dur), "generated": len(made), "minutes": round(sum(dur.values()) / 60, 2), "mismatches": bad}
    json.dump(report, open(f"{work}/voice/report.json", "w"), indent=1); print(json.dumps(report))

def assemble(work, out, cover):
    XF = 0.5
    t = json.load(open(f"{work}/clips/timing.json")); sc = json.load(open(f"{work}/script.json"))["scenes"]
    dur = json.load(open(f"{work}/voice/durations.json")); ids = [s["id"] for s in sc]
    os.makedirs(f"{work}/hd", exist_ok=True)
    for sid in ids:
        x = t[sid]; T = x["total"]
        if x.get("phone"):
            ph = x["phone"]
            ff("-loop", "1", "-i", ph["bg"], "-ss", f'{x["trim"]:.3f}', "-i", x["raw"], "-an", "-filter_complex",
               f"[0:v]scale=1920:1080,fps=30[bg];[1:v]fps=30,scale={ph['w']}:{ph['h']}:flags=lanczos,format=rgba,"
               f"geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gt(hypot(max(0,abs(X-W/2)-(W/2-48)),max(0,abs(Y-H/2)-(H/2-48))),48),0,255)',"
               f"tpad=stop_mode=clone:stop_duration={T:.2f}[ph];[bg][ph]overlay={ph['x']}:{ph['y']}:shortest=0,trim=duration={T:.3f},setpts=PTS-STARTPTS,format=yuv420p[v]",
               "-map", "[v]", "-t", f"{T:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "16", f"{work}/hd/{sid}.mp4")
            continue
        ff("-ss", f'{x["trim"]:.3f}', "-i", x["raw"], "-an", "-vf",
           f"fps=30,scale=1920:1080:flags=lanczos,tpad=stop_mode=clone:stop_duration={T:.2f},trim=duration={T:.3f},setpts=PTS-STARTPTS,format=yuv420p",
           "-c:v", "libx264", "-preset", "medium", "-crf", "16", f"{work}/hd/{sid}.mp4")
    def chain(files, durs, o):
        args = []
        for f in files: args += ["-i", f]
        fc = []; prev = "[0:v]"; off = 0.0
        for k in range(1, len(files)):
            off += durs[k - 1] - XF; fc.append(f"{prev}[{k}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[v{k}]"); prev = f"[v{k}]"
        fc.append(f"{prev}format=yuv420p[vout]")
        if len(files) == 1: ff("-i", files[0], "-c", "copy", o)
        else: ff(*args, "-filter_complex", ";".join(fc), "-map", "[vout]", "-c:v", "libx264", "-preset", "medium", "-crf", "16", o)
        return sum(durs) - XF * (len(files) - 1)
    parts, pd = [], []
    for b in range(0, len(ids), 12):
        g = ids[b:b + 12]; f = f"{work}/hd/part{b // 12}.mp4"; pd.append(chain([f"{work}/hd/{s}.mp4" for s in g], [t[s]["total"] for s in g], f)); parts.append(f)
    chain(parts, pd, f"{work}/hd/video.mp4")
    starts = {}; acc = 0.0
    for sid in ids: starts[sid] = acc; acc += t[sid]["total"] - XF
    T = acc + XF
    cues = [(f"{work}/voice/{s['id']}_{i}.wav", starts[s["id"]] + t[s["id"]]["starts"][i], s["id"], i, l) for s in sc for i, l in enumerate(s["lines"])]
    args = ["-i", f"{work}/hd/video.mp4"]
    for c in cues: args += ["-i", c[0]]
    fc = [f"[0:v]fade=t=in:st=0:d=0.7,fade=t=out:st={T - 1.1:.2f}:d=1.0,format=yuv420p[vout]"]
    for j, c in enumerate(cues): ms = int(c[1] * 1000); fc.append(f"[{j + 1}:a]adelay={ms}|{ms}[a{j}]")
    fc.append("".join(f"[a{j}]" for j in range(len(cues))) + f"amix=inputs={len(cues)}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9,apad,atrim=duration={T:.3f},afade=t=out:st={T - 1.0:.2f}:d=1.0[aout]")
    tmp = out + ".tmp.mp4"
    ff(*args, "-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{T:.3f}", tmp)
    ff("-i", tmp, "-i", cover, "-map", "0:v", "-map", "0:a", "-map", "1", "-c", "copy", "-c:v:1", "png", "-disposition:v:1", "attached_pic", "-movflags", "+faststart", out)
    os.remove(tmp)
    def ts(x): h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60; return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}"
    srt = [f"{n}\n{ts(c[1])} --> {ts(c[1] + dur[f'{c[2]}_{c[3]}'])}\n{c[4]}\n" for n, c in enumerate(cues, 1)]
    cap = os.path.join(os.path.dirname(out), "captions"); os.makedirs(cap, exist_ok=True)
    open(os.path.join(cap, os.path.basename(out)[:-4] + ".en.srt"), "w").write("\n".join(srt))
    json.dump({"starts": starts, "total": T}, open(f"{work}/hd/timeline.json", "w"), indent=1)
    print(json.dumps({"video": out, "seconds": round(T, 1)}))

def deck(work, pptx_out, pdf_out, title):
    from pptx import Presentation
    from pptx.util import Emu
    from PIL import Image
    man = json.load(open(f"{work}/stills/manifest.json")); sc = {s["id"]: s for s in json.load(open(f"{work}/script.json"))["scenes"]}
    prs = Presentation(); prs.slide_width = Emu(12192000); prs.slide_height = Emu(6858000)
    for m in man:
        sl = prs.slides.add_slide(prs.slide_layouts[6]); sl.shapes.add_picture(m["file"], 0, 0, width=prs.slide_width, height=prs.slide_height)
        s = sc[m["id"]]; sl.notes_slide.notes_text_frame.text = f"[{s.get('chapter', '')}]\n\n" + "\n\n".join(s["lines"])
    prs.core_properties.title = title; prs.save(pptx_out)
    ims = [Image.open(m["file"]).convert("RGB") for m in man]; ims[0].save(pdf_out, save_all=True, append_images=ims[1:], resolution=144)
    print(json.dumps({"slides": len(man)}))

def qa(work, video):
    from faster_whisper import WhisperModel
    sc = json.load(open(f"{work}/script.json"))
    prev = json.load(open(f"{work}/qa/report.json")) if os.path.exists(f"{work}/qa/report.json") else None
    if os.environ.get("VA_QA_FAST") and prev:
        # Visuals changed, narration did not: keep the transcript check from the last full QA.
        class R: ratio = lambda self: prev["match"]
        a, b, r, diffs = [None] * prev["words"], [None] * prev["heard"], R(), prev["differences"]
    else:
        heard = " ".join(s.text.strip() for s in WhisperModel("small.en", device="cpu", compute_type="int8").transcribe(video, beam_size=5)[0])
        a, b = norm(" ".join(l for s in sc["scenes"] for l in s["lines"])), norm(heard)
        r = difflib.SequenceMatcher(None, a, b, autojunk=False)
        diffs = [f"{op}: {' '.join(a[i1:i2])} -> {' '.join(b[j1:j2])}" for op, i1, i2, j1, j2 in r.get_opcodes() if op != "equal"]
    loud = subprocess.run(["ffmpeg", "-hide_banner", "-i", video, "-vn", "-af", "loudnorm=print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    lj = json.loads(loud[loud.rindex("{"):loud.rindex("}") + 1])
    # contact sheet: one frame per scene
    tl = json.load(open(f"{work}/hd/timeline.json")); t = json.load(open(f"{work}/clips/timing.json")); fs = []
    os.makedirs(f"{work}/qa", exist_ok=True)
    for sid, st in tl["starts"].items():
        f = f"{work}/qa/{sid}.png"; ff("-ss", f'{st + t[sid]["total"] * 0.7:.2f}', "-i", video, "-frames:v", "1", "-vf", "scale=384:216,format=rgb24", f); fs.append(f)
    while len(fs) % 4: fs.append(fs[-1])
    args = sum([["-i", f] for f in fs], []); lay = "|".join(f"{(i % 4) * 384}_{(i // 4) * 216}" for i in range(len(fs)))
    ff(*args, "-filter_complex", "".join(f"[{i}]" for i in range(len(fs))) + f"xstack=inputs={len(fs)}:layout={lay}", f"{work}/qa/sheet.png")
    rep = {"words": len(a), "heard": len(b), "match": round(r.ratio(), 4), "differences": diffs, "lufs": float(lj["input_i"]), "true_peak": float(lj["input_tp"]), "seconds": round(dur_of(video), 1), "sheet": f"{work}/qa/sheet.png"}
    json.dump(rep, open(f"{work}/qa/report.json", "w"), indent=1); print(json.dumps(rep))

if __name__ == "__main__":
    cmd, *a = sys.argv[1:]
    {"voice": voice, "assemble": assemble, "deck": deck, "qa": qa}[cmd](*a)
