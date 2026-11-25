# File storage (S3)

Owner, 2026-11-25. Buckets (Terraform `infra/terraform/main.tf`): `del-marketplace-production-<account>` and
`del-marketplace-staging-<account>`: private (Block Public Access, bucket-owner-enforced), SSE-S3 encryption,
versioning on production (old versions kept 30 days), CORS for the site's origin only, incomplete multipart uploads
aborted after 3 days, `temporary-uploads/` expired after 7 days. The server signs with its IAM role (no keys).

## Layout (`apps/api/src/common/storage-keys.ts`)

```
instructors/<instructorId>/courses/<courseId>/videos/<assetId>/source.mp4   (+ captions.vtt beside it)
instructors/<instructorId>/courses/<courseId>/resources/<uuid>/<file>       lesson files and the course package
instructors/<instructorId>/videos/<assetId>/…                               a video uploaded before it has a course
instructors/<instructorId>/resources/<uuid>/<file>
images/<ownerId>/…   images/covers/<courseId>-<hash>.png                    uploaded images, generated covers
hls/<random>/…                                                              encrypted HLS segments (protected playback)
support/<userId>/…   contact/<messageId>/…                                  support attachments, contact screenshots
temporary-uploads/…                                                         reserved for staged uploads (expire in 7 days)
```

Stable ids, never names. Older local keys (`videos/<assetId>/…`, `resources/<ownerId>/…`) remain valid.

## Access

Browsers never read the bucket directly without a short-lived signed URL: uploads use presigned PUTs to the
uploader's own prefix (checked against the course owner); downloads and playback are signed after the API checks the
enrolment and its one-year expiry (`hasAccess`), or the encrypted HLS session for protected video. An instructor can
attach only keys under their own prefix (`ownsResourceKey`). Deleting a course deletes its database rows; files are not
bulk-deleted, so nothing shared is removed by accident (a super admin cleans up with the AWS console if needed).

## Not uploaded

Local training videos and video-academy output stay local until the owner releases them (rule 23).
