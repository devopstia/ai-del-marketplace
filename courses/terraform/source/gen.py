import re, json, sys, glob, os
HERE = os.path.dirname(os.path.abspath(__file__))
FIRST_CR = 129
ORIGIN = {"owner": "[owner original]", "owner+improved": "[owner original, updated]", "new": "[new, proposed]", "ai": "[new, proposed: AI]"}
DEPS = {"2.3": "0.2", "3.7": "2.3, 3.5", "8.2": "8.1, 3.7", "8.4": "8.2", "11.1": "10.3", "11.4": "8.8, 11.1", "11.7": "11.2 (13.4 optional)",
        "12.2": "10.3", "13.1": "8.2", "13.2": "13.1", "13.3": "11.7", "14.2": "14.1, CR-077–CR-082 (prompt engineering)", "14.4": "12.2, 8.5",
        "14.5": "14.1", "14.6": "13.1, 14.3", "14.7": "12.2, 12.3, 14.2", "15.2": "15.1", "15.3": "15.2", "15.4": "15.3",
        "16.1": "11.1", "17.1": "all core modules", "17.2": "10.5, 11.4, 8.2", "17.3": "13.1, 14.6, 12.2, 12.3", "17.4": "17.3"}
NOLAB = {"0.1": "no lab (introduction video)", "0.2": "checklist PDF and the CLI commands for budgets and tag searches (no Terraform)", "17.1": "the capstone requirements and design PDF (no Terraform yet)", "17.5": "no lab (wrap-up; final assessment JSON)"}
FUNDAMENTALS = ["1.1", "1.2", "1.3", "2.1", "2.2", "3.1", "3.2", "3.3", "3.4", "3.6", "5.1", "5.2", "5.3"]

def parse():
    mods = []; cur = None; last = None
    for f in sorted(glob.glob(os.path.join(HERE, "data*.txt"))):
        for raw in open(f, encoding="utf-8"):
            line = raw.rstrip("\n")
            if not line.strip(): continue
            if line.startswith("M "):
                n, title, desc = [x.strip() for x in line[2:].split("|")]
                mods.append({"n": n, "title": title, "desc": desc, "lessons": []}); continue
            if line.startswith("L "):
                p = [x.strip() for x in line[2:].split("|")]
                cur = {"id": p[0], "title": p[1], "origin": p[2], "scope": p[3], "mins": int(p[4]), "slides": p[5], "repo": p[6],
                       "O": [], "Q": [], "QA": [], "QZ": [], "N": []}
                mods[-1]["lessons"].append(cur); continue
            m = re.match(r"^(O|D|DA|DZ|RA|RZ|CA|CZ|N|Q|QA|QZ): (.*)$", line)
            if m:
                k, v = m.groups(); last = k
                if k == "O": cur["O"] = [x.strip() for x in v.split(";")]
                elif k in ("Q", "QA", "QZ"):
                    parts = [x.strip() for x in v.split(" / ")]
                    cur[k].append({"q": parts[0], "opts": parts[1:-1], "a": parts[-1].lstrip("=")})
                elif k == "N": cur["N"].append(v)
                else: cur[k] = v
            else:  # continuation
                if last == "N": cur["N"].append(line.strip())
                else: cur[last] = cur.get(last, "") + " " + line.strip()
    return mods

def split_repo(repo):
    out = {"aws": [], "azure": [], "mkt": [], "plain": []}
    if repo == "-": return out
    for part in [x.strip() for x in repo.split(";")]:
        m = re.match(r"^(aws|azure|marketplace):\s*(.*)$", part)
        if m:
            k = {"aws": "aws", "azure": "azure", "marketplace": "mkt"}[m.group(1)]
            out[k] += [x.strip() for x in m.group(2).split(", ")]
        else:
            out["plain"].append(part)
    return out

def repo_text(l, cloud):
    r = split_repo(l["repo"])
    items = []
    if l["scope"] == "shared":
        items += [f"`aws-terraform/{x}`" if not x.startswith(("devopstia", "Dockerfile")) else x for x in r["plain"] + r["aws"]]
        items += [f"`azure-terraform/{x.replace('azure-terraform/','')}`" for x in r["azure"]]
    elif cloud == "aws":
        items += [f"`aws-terraform/{x}`" for x in r["plain"] + r["aws"]]
    else:
        items += [f"`azure-terraform/{x.replace('azure-terraform/','')}`" for x in r["azure"]]
        if not r["azure"] and r["plain"] + r["aws"]:
            items.append("no Azure exercise in the owner's repo (mirrors " + ", ".join(f"`aws-terraform/{x}`" for x in r["plain"] + r["aws"]) + ")")
    return ", ".join(items) if items else "— (none in the owner's repo)"

def code_text(l, cloud):
    if l["id"] in NOLAB: return NOLAB[l["id"]]
    r = split_repo(l["repo"])
    slug = re.sub(r"[^a-z0-9]+", "-", l["title"].lower()).strip("-")[:48].rstrip("-")
    if l["scope"] == "shared":
        own = [x for x in r["mkt"] if not x.startswith("code/azure/")]
        return ", ".join(f"`courses/terraform/code/{x.replace('code/','')}`" for x in own) or f"GEN builds `courses/terraform/code/shared/{slug}/` (cloud-neutral providers: local, random, terraform_data)"
    if cloud == "aws":
        own = [x for x in r["mkt"] if not x.startswith("code/azure/")]
        return ", ".join(f"`courses/terraform/code/{x.replace('code/','')}` (ready, validated)" for x in own) or f"GEN builds `courses/terraform/code/{slug}/`"
    own = [x for x in r["mkt"] if x.startswith("code/azure/")]
    if own: return ", ".join(f"`courses/terraform/code/{x.replace('code/','')}` (ready, validated)" for x in own)
    shared_files = [x for x in r["mkt"] if not x.startswith("code/terraform-")]
    extra = (" (reuses " + ", ".join(f"`{x}`" for x in shared_files) + ")") if shared_files else ""
    return f"GEN builds `courses/terraform/code/azure/{slug}/`{extra}"

def quiz(l, cloud):
    qs = l["Q"] + (l["QA"] if cloud == "aws" else l["QZ"] if cloud == "azure" else [])
    out = []
    for i, q in enumerate(qs, 1):
        letters = "ABC"
        opts = "; ".join(f"{letters[j]}: {o}" for j, o in enumerate(q["opts"]))
        out.append(f"  {i}. {q['q']} ({opts}) → **{q['a'].upper()}**")
    return out

def cost(l, cloud):
    if l["scope"] == "shared": return "$0 (cloud-neutral demo, runs locally)"
    return l.get("CA" if cloud == "aws" else "CZ", "$0")

def resources(l, cloud):
    if l["scope"] == "shared": return "none (local, random, terraform_data providers)"
    return l.get("RA" if cloud == "aws" else "RZ", "none or free resources only")

def demo(l, cloud):
    base = l.get("D", "")
    if l["scope"] == "shared": return base
    spec = l.get("DA" if cloud == "aws" else "DZ", "")
    return (base + " " + spec).strip()

def cleanup(l, cloud):
    if l["id"] in NOLAB: return "nothing is created" if l["id"] != "0.2" else "keep the budget alert (free); nothing else is created"
    if l["scope"] == "shared": return "`terraform destroy` (local files only); nothing in any cloud"
    if cloud == "aws": return "`terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)"
    return "`terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)"

def deps(l, prev):
    return DEPS.get(l["id"], prev or "—")

def sl(l):
    return 'none in the deck (new lesson)' if l['slides'] == '-' else l['slides']

def materials(l):
    s = l["slides"]
    src = f"PDF slides from the owner's deck ({s}), redrawn to the course standard" if s not in ("-",) and "extends" not in s else "PDF slides (new, course standard)"
    return f"{src}; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)"

def build():
    mods = parse()
    crs = []  # list of dicts
    n = FIRST_CR
    stats = {"lessons": 0, "shared": 0, "cloud": 0, "mins_course": 0, "mins_shared": 0, "by_origin": {}, "mins_origin": {}}
    prev = None
    for m in mods:
        for l in m["lessons"]:
            stats["lessons"] += 1; stats["mins_course"] += l["mins"]
            stats["by_origin"][l["origin"]] = stats["by_origin"].get(l["origin"], 0) + 1
            stats["mins_origin"][l["origin"]] = stats["mins_origin"].get(l["origin"], 0) + l["mins"]
            if l["scope"] == "shared":
                stats["shared"] += 1; stats["mins_shared"] += l["mins"]
                l["cr"] = {"shared": f"CR-{n:03d}"}; crs.append((f"CR-{n:03d}", "shared", m, l, prev)); n += 1
            else:
                stats["cloud"] += 1
                l["cr"] = {"aws": f"CR-{n:03d}", "azure": f"CR-{n+1:03d}"}
                crs.append((f"CR-{n:03d}", "aws", m, l, prev)); crs.append((f"CR-{n+1:03d}", "azure", m, l, prev)); n += 2
            prev = l["id"]
    stats["first"] = f"CR-{FIRST_CR:03d}"; stats["last"] = f"CR-{n-1:03d}"; stats["crs"] = n - FIRST_CR
    return mods, crs, stats

def curriculum(mods, cloud, stats):
    cname = "AWS" if cloud == "aws" else "Azure"
    title = f"AI-Powered Terraform on {cname}: From Beginner to Advanced"
    other = "Azure" if cloud == "aws" else "AWS"
    out = [f"# {title}: curriculum", "",
           f"Planned 2026-11-27 (Phase 1). Plan and production order: `TERRAFORM_MASTERCLASS_PLAN.md`; slide/repo inventory: `CONTENT_INVENTORY.md`; requests: `courses/CONTENT_REQUESTS.md` › CR-129 onward.",
           f"The owner's deck (`/home/tia/work/terraform-course/Terraform.pptx`, 624 slides) and repo (`devopstia/terraform-course-del`, `{'aws' if cloud=='aws' else 'azure'}-terraform/`) are the foundation: their order, examples and projects are used, updated where outdated, never replaced.",
           "",
           "**Labels:** [owner original] = a deck section taught as the owner teaches it · [owner original, updated] = the owner's lesson with outdated parts fixed (each fix listed) · [new, proposed] = a gap filled · [new, proposed: AI] = the AI strand · **[shared]** = one cloud-neutral video used by both the AWS and the Azure course (demos use the local, random and terraform_data providers, so a student of either cloud follows without an account).",
           f"**Self-contained:** a student of this course never needs the {other} course. Every lesson that touches a cloud has its own {cname} video and lab.",
           "**Budget (rule in `CONTENT_REQUESTS.md`):** $100/month for AWS and Azure together; the video agent estimates each run, logs it in its CLOUD_BUDGET.md and destroys and verifies right after recording (no owner pause, owner 2026-11-28); the $80/$100 budget alarms in both clouds stay as the safety net.",
           "**The AI rule, in every lesson that uses AI:** AI drafts; fmt, validate, tests, policy, the plan and a person verify; never auto-apply.", ""]
    tot = stats["mins_course"]
    out.append(f"**Size:** {len(mods)} modules, {stats['lessons']} videos, about {tot//60} h {tot%60:02d} min. {stats['shared']} videos are shared with the {other} course.")
    out.append("")
    out.append("| Module | Videos | Minutes | Owner original / updated / new / AI |")
    out.append("|---|---:|---:|---|")
    for m in mods:
        c = {k: sum(1 for l in m["lessons"] if l["origin"] == k) for k in ORIGIN}
        out.append(f"| {m['n']} {m['title']} | {len(m['lessons'])} | {sum(l['mins'] for l in m['lessons'])} | {c['owner']} / {c['owner+improved']} / {c['new']} / {c['ai']} |")
    out.append("")
    prev = None
    for m in mods:
        out.append(f"## Module {m['n']}: {m['title']}"); out.append(m["desc"]); out.append("")
        for l in m["lessons"]:
            cr = l["cr"]["shared"] if l["scope"] == "shared" else l["cr"][cloud]
            tag = ORIGIN[l["origin"]] + (" **[shared]**" if l["scope"] == "shared" else "")
            out.append(f"### {l['id']} {l['title']}  {tag}")
            out.append(f"- **Request:** {cr} · **Duration:** ~{l['mins']} min · **Depends on:** {deps(l, prev)}")
            out.append(f"- **Objectives:** " + "; ".join(l["O"]))
            out.append(f"- **Slides:** {sl(l)} · **Owner's repo:** {repo_text(l, cloud)}")
            out.append(f"- **Demo:** {demo(l, cloud)}")
            out.append(f"- **Code:** {code_text(l, cloud)}")
            out.append(f"- **Cloud resources:** {resources(l, cloud)} · **Cost per run:** {cost(l, cloud)} · **Cleanup:** {cleanup(l, cloud)}")
            out.append(f"- **Materials:** {materials(l)}")
            if l["N"]: out.append(("- **Notes:** " if cloud == "aws" else "- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** ") + " ".join(l["N"]))
            out.append("- **Quiz:**"); out += quiz(l, cloud)
            out.append(""); prev = l["id"]
    out.append("## Assessments")
    out.append("- A module assessment (8–10 questions) at the end of each module, from that module's lesson quizzes and objectives.")
    out.append("- Final assessment: 20 questions across the course, in lesson 17.5. Certificate as for every DEL course.")
    out.append("")
    return "\n".join(out)

def cr_blocks(crs):
    rows, blocks = [], []
    for cid, cloud, m, l, prev in crs:
        course = {"shared": "Terraform AWS + Azure (shared video)", "aws": "AI-Powered Terraform on AWS", "azure": "AI-Powered Terraform on Azure"}[cloud]
        tag = ORIGIN[l["origin"]]
        pri = "P1" if l["id"] in FUNDAMENTALS else ("P3" if m["n"] in ("16",) else "P2")
        rows.append(f"| {cid} | {course} | M{m['n']} · {l['id']} | {l['title']} {tag} | GEN | 2026-11-28 | {pri} | requested (planning; order waits for the owner's OK) | — | — |")
        q = quiz(l, cloud if cloud != "shared" else "shared")
        b = [f"#### {cid} {l['title']}" + (" (AWS)" if cloud == "aws" else " (Azure)" if cloud == "azure" else " (shared)"),
             f"- Course / module / position: {course} · Module {m['n']} {m['title']} · lesson {l['id']}" + (f", after {prev}" if prev else ", first in the module") + f" · {tag}" + (" · one video for both courses" if cloud == "shared" else ""),
             f"- Learning objectives: " + "; ".join(l["O"]),
             f"- Slides: owner's deck: {sl(l)} (PDF next to the PPTX, course standard) · Owner's repo: {repo_text(l, cloud if cloud!='shared' else 'aws')}",
             f"- Live demonstration: {demo(l, cloud)}",
             f"- Lab ZIP / code: {code_text(l, cloud if cloud!='shared' else 'aws')}; README with requirements, cost, steps, cleanup; `.tfvars.example` only",
             f"- Cloud resources: {resources(l, cloud)} · Cost per run: {cost(l, cloud)} · Cleanup: {cleanup(l, cloud)}",
             f"- Depends on: {deps(l, prev)} · Length guide: ~{l['mins']} min · Priority: {'P1' if l['id'] in FUNDAMENTALS else ('P3' if m['n']=='16' else 'P2')} · Owner: GEN · Status: requested"]
        if l["N"]: b.append("- Notes: " + " ".join(l["N"]))
        where = {"shared": "both curricula", "aws": "`courses/terraform/TERRAFORM_AWS_CURRICULUM.md`", "azure": "`courses/terraform/TERRAFORM_AZURE_CURRICULUM.md`"}[cloud]
        b.append(f"- Quiz: {len(q)} spoken questions with answers in {where} › {l['id']} (\"Question N of {len(q)} … A: …; B: …; or C: …?\" / \"The answer is X: …\")")
        blocks.append("\n".join(b))
    return rows, blocks

if __name__ == "__main__":
    mods, crs, stats = build()
    outdir = sys.argv[1]
    open(os.path.join(outdir, "TERRAFORM_AWS_CURRICULUM.md"), "w").write(curriculum(mods, "aws", stats))
    open(os.path.join(outdir, "TERRAFORM_AZURE_CURRICULUM.md"), "w").write(curriculum(mods, "azure", stats))
    rows, blocks = cr_blocks(crs)
    open(os.path.join(HERE, "cr_rows.md"), "w").write("\n".join(rows) + "\n")
    open(os.path.join(HERE, "cr_blocks.md"), "w").write("\n\n".join(blocks) + "\n")
    idx = [{"id": l["id"], "title": l["title"], "origin": l["origin"], "scope": l["scope"], "mins": l["mins"], "slides": l["slides"], "cr": l["cr"], "module": m["n"], "mtitle": m["title"]} for m in mods for l in m["lessons"]]
    json.dump({"stats": stats, "lessons": idx}, open(os.path.join(HERE, "index.json"), "w"), indent=1)
    print(json.dumps(stats))
