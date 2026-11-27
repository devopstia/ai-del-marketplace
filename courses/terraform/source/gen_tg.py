"""Terragrunt courses: one curriculum file (AWS and Azure courses, same lesson ids) and module-level requests CR-282…"""
import os, sys, json
import gen

HERE = os.path.dirname(os.path.abspath(__file__))
gen.NOLAB = {"0.1": "no lab (introduction video)", "9.1": "the capstone requirements and design PDF", "9.5": "no lab (wrap-up; final assessment JSON)"}
gen.DEPS = {"0.1": "the Terraform masterclass of the same cloud", "1.1": "Terraform masterclass (modules 8–10)", "2.1": "1.3; masterclass 8.2 state store",
            "4.2": "4.1", "6.1": "masterclass 13.1 (OIDC)", "6.3": "masterclass 11.7 (Jenkins)", "8.2": "6.1", "8.3": "masterclass 14.5", "9.2": "5.2, 4.2", "9.3": "6.2, 7.1, 8.2"}
gen.FUNDAMENTALS = []
TITLES = {"aws": "AI-Powered Terragrunt on AWS: Terraform at Scale", "azure": "AI-Powered Terragrunt on Azure: Terraform at Scale"}
VERS = "Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease"

def repo_tg(l, cloud):
    r = gen.split_repo(l["repo"])
    if l["repo"] == "-": return "— (none in the owner's repo)"
    own = r["plain"] + r["aws"]
    items = [f"`aws-terraform/{x}`" for x in own]
    if cloud == "azure" and own: items = ["mirrors " + ", ".join(items) + " (no Azure Terragrunt code in the owner's repo)"]
    return ", ".join(items) or "—"

def code_tg(l, cloud):
    if l["id"] in gen.NOLAB: return gen.NOLAB[l["id"]]
    r = gen.split_repo(l["repo"])
    mk = r["mkt"]
    if cloud == "aws": own = [x for x in mk if "/azure" not in x]
    elif cloud == "azure": own = [x for x in mk if "/aws" not in x]
    else: own = mk
    if own: return ", ".join(f"`courses/terraform/{x}` (ready, validated)" for x in own)
    return "GEN builds it in `courses/terraform/code/terragrunt/` (" + ("neutral providers" if l["scope"] == "shared" else cloud) + ")"

def lesson_block(l, mods_prev):
    tag = gen.ORIGIN[l["origin"]] + (" **[shared]**" if l["scope"] == "shared" else "")
    out = [f"### {l['id']} {l['title']}  {tag}"]
    req = gen.INTRO_CR.replace("CR-129/CR-130 are superseded by it", "none reserved here") if l["id"] == "0.1" else l["cr_text"]
    out.append(f"- **Request:** {req} · **Duration:** ~{l['mins']} min · **Depends on:** {gen.DEPS.get(l['id'], mods_prev or '—')}")
    out.append(f"- **Versions:** {VERS}" + (" · **re-recorded on these versions**" if l["origin"] == "owner+improved" else ""))
    out.append("- **Objectives:** " + "; ".join(l["O"]))
    out.append(f"- **Slides:** {gen.sl(l)} · **Owner's repo:** {repo_tg(l, 'aws')}")
    if l["scope"] == "shared":
        out.append(f"- **Demo (both courses, one video):** {l.get('D', '')}")
        out.append(f"- **Code:** {code_tg(l, 'shared')} · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud")
        out.append("- **Quiz:**"); out += gen.quiz(l, "shared")
    else:
        for cloud, name in (("aws", "AWS course"), ("azure", "Azure course")):
            out.append(f"- **{name}:** {gen.demo(l, cloud)}")
            out.append(f"  - Code: {code_tg(l, cloud)} · Resources: {gen.resources(l, cloud)} · Cost per run: {gen.cost(l, cloud)} · Cleanup: {gen.cleanup(l, cloud).replace('terraform-aws-masterclass','terragrunt-aws').replace('terraform-azure-masterclass','terragrunt-azure').replace('`terraform destroy`','`terragrunt run --all destroy`')}")
        out.append("- **Quiz** (questions 1–3 in both courses; question 4 per course):")
        q = gen.quiz(l, "aws"); qz = gen.quiz(l, "azure")
        out += q[:len(l["Q"])]
        if l["QA"]: out.append("  AWS: " + q[-1].strip())
        if l["QZ"]: out.append("  Azure: " + qz[-1].strip())
    if l["N"]: out.append("- **Notes:** " + " ".join(l["N"]))
    out.append("")
    return out

def main(outdir):
    mods = gen.parse("tg_data.txt")
    # module-level requests within CR-282…CR-299 (coordinator: CR-300+ is theirs)
    n = 282; crs = []
    for m in mods:
        shared = [l for l in m["lessons"] if l["scope"] == "shared"]
        cloud = [l for l in m["lessons"] if l["scope"] == "cloud" and l["id"] != "0.1"]
        ids = {}
        if shared: ids["shared"] = f"CR-{n:03d}"; crs.append((ids["shared"], "shared", m, shared)); n += 1
        if cloud:
            ids["aws"] = f"CR-{n:03d}"; crs.append((ids["aws"], "aws", m, cloud)); n += 1
            ids["azure"] = f"CR-{n:03d}"; crs.append((ids["azure"], "azure", m, cloud)); n += 1
        for l in m["lessons"]:
            l["cr_text"] = ids.get("shared") if l["scope"] == "shared" else f"{ids.get('aws')} (AWS) / {ids.get('azure')} (Azure)"
    assess = f"CR-{n:03d}"; n += 1
    assert n - 1 <= 299, n
    lessons = [l for m in mods for l in m["lessons"]]
    sh = [l for l in lessons if l["scope"] == "shared"]; cl = [l for l in lessons if l["scope"] == "cloud"]
    per_course = sum(l["mins"] for l in lessons)
    stats = {"modules": len(mods), "lessons_per_course": len(lessons), "shared": len(sh), "cloud": len(cl), "videos_total": len(sh) + 2 * len(cl),
             "mins_per_course": per_course, "first": "CR-282", "last": assess, "assessment_cr": assess,
             "by_origin": {k: sum(1 for l in lessons if l["origin"] == k) for k in gen.ORIGIN}}
    h = [f"# AI-Powered Terragrunt: Terraform at Scale on AWS and on Azure: curriculum", "",
         "Planned 2026-11-28 (owner: \"we will also need Terragrunt and terraform course\"). Two courses with the same lesson ids, as the "
         "masterclasses (owner's mirror rule): **" + TITLES["aws"] + "** and **" + TITLES["azure"] + "**. Shared videos are "
         "cloud-neutral and used by both; every cloud lesson has an AWS and an Azure video and lab. Plan: `TERRAFORM_MASTERCLASS_PLAN.md` § 12; "
         "code: `code/terragrunt/`; requests: " + f"CR-282 … {assess} (module level) in `courses/CONTENT_REQUESTS.md`.", "",
         "**Foundation:** the owner's Terragrunt section (deck slides 574–583, install 56–57, Jenkins + Terragrunt 620–622) and "
         "`aws-terraform/terragrunt/live` (development, staging, production with `common.yaml`; units vpc, ec2, bastion-host, eks-control-plane). "
         "Slides 584–609 (HCP Terraform, Packer) stay in the masterclass. The owner's `devopstia/s4` repo (session04/terragrunt) is a public "
         "older variant: same pattern, not needed.",
         f"**Versions:** {VERS}. Labels as in the masterclasses: [owner original] · [owner original, updated] · [new, proposed] · [new, proposed: AI] · **[shared]**.",
         "**Prerequisite:** the Terraform masterclass of the same cloud (modules 8–10, 13); the course does not re-teach Terraform.",
         "**Budget:** estimate, log, destroy; no owner pause; the $80/$100 monthly alarms remain (`CONTENT_REQUESTS.md`). Almost every lab uses free resources.",
         "**AI rule:** AI drafts units and reviews; Terragrunt (`hcl fmt`, `hcl validate`, `render`, plan) and a person verify; never auto-apply.", "",
         f"**Size per course:** {len(mods)} modules, {len(lessons)} videos, about {per_course//60} h {per_course%60:02d} min "
         f"({len(sh)} shared videos, {len(cl)} cloud lessons). Both courses: {len(sh) + 2*len(cl)} videos.", "",
         "| Module | Videos | Minutes | Requests |", "|---|---:|---:|---|"]
    for m in mods:
        ids = sorted({x for l in m["lessons"] for x in (l["cr_text"] or "").replace(" (AWS)", "").replace(" (Azure)", "").split(" / ") if x and x != "None" and l["id"] != "0.1"})
        h.append(f"| {m['n']} {m['title']} | {len(m['lessons'])} | {sum(l['mins'] for l in m['lessons'])} | {', '.join(ids) if ids else 'intro: coordinator (CR-300+)'} |")
    h.append(""); body = []
    prev = None
    for m in mods:
        body += [f"## Module {m['n']}: {m['title']}", m["desc"], ""]
        for l in m["lessons"]:
            body += lesson_block(l, prev); prev = l["id"]
    body += ["## Assessments", f"- {assess}: a module assessment (6–8 questions) for modules 1–9 and a 20-question final assessment, the same for both courses except the cloud questions.", ""]
    open(os.path.join(outdir, "TERRAGRUNT_CURRICULUM.md"), "w").write("\n".join(h + body))
    # requests
    rows, blocks = [], []
    for cid, cloud, m, ls in crs:
        course = {"shared": "Terragrunt AWS + Azure (shared videos)", "aws": TITLES["aws"], "azure": TITLES["azure"]}[cloud]
        rows.append(f"| {cid} | {course} | M{m['n']} {m['title']} | {len(ls)} video{'s' if len(ls) != 1 else ''}: " + "; ".join(f"{l['id']} {l['title']}" for l in ls) + " | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |")
        b = [f"#### {cid} Terragrunt module {m['n']}: {m['title']} ({ {'shared':'shared videos','aws':'AWS course','azure':'Azure course'}[cloud] })",
             f"- Course / module / position: {course} · Module {m['n']} · lessons " + ", ".join(l["id"] for l in ls) + " in this order",
             f"- Versions: {VERS}",
             "- Videos (objectives, demo, code, resources, cost, cleanup and the quiz with answers for each: `courses/terraform/TERRAGRUNT_CURRICULUM.md` › the lesson id):"]
        for l in ls:
            demo = l.get("D", "") if cloud == "shared" else gen.demo(l, cloud)
            b.append(f"  - **{l['id']} {l['title']}** {gen.ORIGIN[l['origin']]} · ~{l['mins']} min · slides {gen.sl(l)} · objectives: " + "; ".join(l["O"]) +
                     f" · demo: {demo} · code: {code_tg(l, cloud)} · cost: {'$0' if cloud=='shared' else gen.cost(l, cloud)} · quiz: {len(l['Q']) + (1 if cloud!='shared' and (l['QA'] if cloud=='aws' else l['QZ']) else 0)} questions")
        b.append("- Lab ZIP per lesson: the code folder, README with cost and cleanup (`terragrunt run --all destroy` + tag search), `.tfvars.example`/`common.yaml` with placeholders only")
        b.append("- Priority: P2 · Owner: GEN · Status: requested (order waits for the owner's OK)")
        blocks.append("\n".join(b))
    rows.append(f"| {assess} | Terragrunt AWS + Azure | Assessments | Module assessments (modules 1–9) and the final assessment (20 questions) | GEN | 2026-11-28 | P2 | requested (planning) | — | — |")
    blocks.append(f"#### {assess} Terragrunt assessments (both courses)\n- Module assessments of 6–8 questions for modules 1–9 and a 20-question final assessment from the lesson objectives and quizzes in `TERRAGRUNT_CURRICULUM.md`; cloud questions per course.\n- Deliver: `assessments/module-<n>.json`, `assessments/final.json` per course · Priority: P2 · Owner: GEN · Status: requested")
    open(os.path.join(HERE, "tg_rows.md"), "w").write("\n".join(rows) + "\n")
    open(os.path.join(HERE, "tg_blocks.md"), "w").write("\n\n".join(blocks) + "\n")
    print(json.dumps(stats))

if __name__ == "__main__":
    main(sys.argv[1])
