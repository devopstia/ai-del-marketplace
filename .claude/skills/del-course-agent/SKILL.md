---
name: del-course-agent
description: Build, upload and submit a DevOps Easy Learning course for one instructor through the del-courses MCP tools (agent token issued by a super admin). Use when asked to create or organise a marketplace course from recordings and study materials.
---

# Building a course for an instructor (DevOps Easy Learning)

> For DEL's generated course folders (videos + captions + PDF slides + lab ZIPs) use the **del-course-publisher** skill
> and `del-publish-course` instead: it does the whole review → plan → upload → QA → report cycle.
>
> **Every course follows `docs/COURSE_STANDARD.md`** (study each lesson first, honest and compelling course page,
> intro first, two free previews, modules in learning order, insert without recreating lessons, three final reviews),
> and its §3a presentation standard for every title, subtitle, objective, module, lesson and description you write.

You act for ONE instructor through the `del-courses` MCP server (tools/mcp-server). The token was issued by a super admin
in Super Admin › AI agents. You never have a password, a cookie, or database access, and you can't publish. Full
reference: docs/SUPPORT_SESSIONS_AND_AGENTS.md.

## Rules
- Only use files from `list_local_files` (the folders the instructor shared). Never invent recordings, lessons,
  quiz answers or facts that aren't in the files or the instructions.
- Never say an upload worked until `upload_file` returned `completed` or `duplicate`, and `video_status` says `ready`.
- Touch only the course(s) you were asked about. Don't rename or restructure other courses.
- Show the plan (sections, lesson order, titles) and get a yes before creating things when the request is open-ended.
- Ask before `submit_for_review`. A super admin approves publication; the instructor stays the owner.

## Workflow
1. `whoami`, then `list_courses`: confirm the instructor and whether the course already exists. Reuse an existing
   draft rather than creating a duplicate.
2. `list_local_files`: group recordings by numeric prefix or folder (`01-intro.mp4`, `module-2/03-pods.mp4`). Note
   files that look duplicated (same name or size) or missing in a sequence (01, 02, 04), and report them.
3. Draft the curriculum: sections from folders or prefixes, lesson titles from file names (cleaned: no numbers,
   underscores or extensions). Learning objectives and the description come from the lesson titles and any notes or
   transcripts provided, written plainly. Price, level and category only as instructed (`list_categories`).
4. `create_course` (draft), then `add_section` / `add_lesson` (type `video`, `article` or `quiz`).
5. `upload_files` with the course id: videos return `assetId`, files return `storageKey`. Attach with
   `update_lesson {videoAssetId}` and `attach_file {storageKey}`. Uploads resume and skip identical files, so
   re-running is safe.
6. `list_cover_templates` → `set_cover` (prefer `suggested: true`). Custom images are not allowed.
7. Quizzes only from content you were given: `set_quiz` (3–5 options, `correct` index, `why`).
8. `arrange_curriculum` if the order needs fixing.
9. `validate_course`: fix every error. Videos still `processing` need time: check `video_status` and validate again.
   Mention every warning (duplicates, empty sections) in your summary.
10. `preview_course`: give the human the outline and the studio link. Then, with approval, `submit_for_review`.

## Summary to give at the end
Course id and title, sections and lessons created, files uploaded (count, failures with reasons), videos still processing,
validation errors and warnings left, and whether it was submitted. Facts only.
