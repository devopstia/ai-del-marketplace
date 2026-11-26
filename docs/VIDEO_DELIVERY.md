# Video delivery: CloudFront and adaptive quality (owner 2026-11-26, option A)

Builds on docs/CONTENT_PROTECTION.md (encrypted HLS, playback sessions). Code: `apps/api/src/protection/hls-packager.ts`
(qualities), `cdn-signer.ts` (CloudFront signed policy), `protection.service.ts` (master and quality playlists),
`worker/video.processor.ts` (packaging, re-packaging), web `app/admin/protection`. Infra: `infra/terraform/cdn.tf`.

## Qualities
The worker packages every ready video as the original quality (copied when it is H.264, else re-encoded) plus lower
qualities from `HLS_RENDITIONS` (default `720,480`; only those at least ~32 px below the source). The added qualities are
H.264 (veryfast, CRF 23, capped: 720p 2.8 Mbit/s, 480p 1.2 Mbit/s) with a keyframe at every segment boundary, AAC audio.
All qualities share the video's AES-128 key. `index.m3u8` for a session is a master playlist; each quality is
`/api/playback/<session>/q/<name>/index.m3u8`. hls.js (and Safari) pick the quality the connection can carry and switch
as it changes. Videos packaged before 2026-11-26 have one quality and keep working; **Admin › Video protection › Add 720p
and 480p** (super admin) re-packages them in the background; the current copy plays until the new one replaces it, then the
old segments are deleted. Re-encoding costs worker CPU (roughly the length of the video per added quality on the t3a.medium).

## CloudFront
One distribution per stack (`d2dpuak871u6qp.cloudfront.net` production, `d1xxac746i9uzz.cloudfront.net` staging) in front of
the media bucket, all edge locations (Africa included, no geographic restriction), HTTPS only, HTTP/2 and 3.
- Only `hls/*` is readable by CloudFront (bucket policy with origin access control); everything else in the bucket stays private.
- Every request needs a CloudFront **signed policy**: the API signs one per playback session covering `hls/<prefix>/*` until
  the session ends (one RSA signature per playlist). Unsigned, expired or other-video links get 403 (verified 2026-11-26).
- The key group holds `infra/terraform/keys/cdn-media-2026-11.pub.pem`; the private key is only in SSM
  `/del-marketplace/<stack>/CDN_PRIVATE_KEY_B64` (base64 PEM, created with the AWS CLI, never in git or Terraform state).
  Rotate: generate a new pair, add the public key to the key group, store the private key, release, then remove the old key.
- Settings: `CDN_URL`, `CDN_KEY_PAIR_ID` (Terraform, SSM), `CDN_PRIVATE_KEY_B64` (SSM). Without them the API signs S3 links
  as before (local and test stacks).
- Captions, free previews (signed MP4) and the encryption key still come from S3 / the API.

## Cost
CloudFront includes 1 TB of data out and 10 million requests per month free; above that about $0.085/GB (North America,
Europe), more in some regions (Africa, South America). docs/AWS_COSTS.md.
