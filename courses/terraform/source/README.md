# Curriculum source

Both curricula (`../TERRAFORM_AWS_CURRICULUM.md`, `../TERRAFORM_AZURE_CURRICULUM.md`) and the CR-129 … CR-281 request
blocks were generated from `data1.txt` … `data6.txt` by `gen.py`, so lesson ids, request ids, quizzes, costs and cleanup
stay the same in all three places.

To change a lesson: edit the data file, run `python3 gen.py ..` (rewrites both curricula; writes `cr_rows.md` and
`cr_blocks.md` here), then update the matching rows/blocks in `courses/CONTENT_REQUESTS.md` by hand (request ids never
change: adding a lesson means new ids after the last one, not renumbering). Small wording fixes can go straight into
the Markdown files; note them here if the data file is not updated.

Format: `M <n> | title | description`, `L <id> | title | owner|owner+improved|new|ai | shared|cloud | minutes | slides | repo`,
then `O:` objectives (`;`), `D:` shared demo, `DA:`/`DZ:` AWS/Azure demo, `RA:`/`RZ:` resources, `CA:`/`CZ:` cost,
`N:` notes, `Q:` quiz for both, `QA:`/`QZ:` cloud-only question (`question / A / B / C / =a`).
