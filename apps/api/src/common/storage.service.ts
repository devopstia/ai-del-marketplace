import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  UploadPartCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { createReadStream, statSync } from 'node:fs';
import type { Readable } from 'node:stream';
import { env } from '../config/env';

/**
 * Private object storage (MinIO locally, S3 in the cloud). Nothing is public: browsers only ever get short-lived
 * presigned URLs, signed against S3_PUBLIC_ENDPOINT so they work from outside the Docker network.
 */
@Injectable()
export class StorageService {
  private readonly internal: S3Client;
  private readonly publicSigner: S3Client;
  readonly bucket: string;

  constructor() {
    const e = env();
    // Local MinIO: fixed keys, path-style URLs. AWS (S3_ENDPOINT=aws): no keys at all, the server's IAM role signs
    // (workload authentication, docs/DEPLOYMENT.md), virtual-hosted URLs.
    const aws = e.S3_ENDPOINT === 'aws';
    const base = {
      region: e.S3_REGION,
      forcePathStyle: !aws,
      ...(e.S3_ACCESS_KEY ? { credentials: { accessKeyId: e.S3_ACCESS_KEY, secretAccessKey: e.S3_SECRET_KEY } } : {}),
    };
    this.internal = new S3Client({ ...base, ...(aws ? {} : { endpoint: e.S3_ENDPOINT }) });
    this.publicSigner = new S3Client({ ...base, ...(aws ? {} : { endpoint: e.S3_PUBLIC_ENDPOINT }) });
    this.bucket = e.S3_BUCKET;
  }

  /** Presigned PUT for a browser upload. */
  presignPut(key: string, contentType: string, expiresIn = 3600) {
    return getSignedUrl(this.publicSigner, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), {
      expiresIn,
    });
  }

  // ---------- resumable multipart uploads (AI agents, large files; docs/SUPPORT_SESSIONS_AND_AGENTS.md) ----------
  async createMultipart(key: string, contentType: string): Promise<string> {
    const r = await this.internal.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }));
    if (!r.UploadId) throw new Error('storage did not return an upload id');
    return r.UploadId;
  }

  /** Presigned PUT for one part (1-based). The client keeps the ETag response header of each part. */
  presignPart(key: string, uploadId: string, partNumber: number, expiresIn = 3600) {
    return getSignedUrl(this.publicSigner, new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn });
  }

  /** Parts already stored (for resuming): number, ETag, size. */
  async listParts(key: string, uploadId: string): Promise<{ partNumber: number; etag: string; size: number }[]> {
    const out: { partNumber: number; etag: string; size: number }[] = [];
    let marker: string | undefined;
    for (;;) {
      const r = await this.internal.send(new ListPartsCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }));
      for (const p of r.Parts ?? []) if (p.PartNumber && p.ETag) out.push({ partNumber: p.PartNumber, etag: p.ETag, size: Number(p.Size ?? 0) });
      if (!r.IsTruncated) break;
      marker = r.NextPartNumberMarker;
    }
    return out.sort((a, b) => a.partNumber - b.partNumber);
  }

  async completeMultipart(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
    await this.internal.send(new CompleteMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) } }));
  }

  async abortMultipart(key: string, uploadId: string) {
    await this.internal.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId })).catch(() => undefined);
  }

  /** Presigned GET for a browser (playback, download). */
  presignGet(key: string, expiresIn = 300, opts: { downloadName?: string } = {}) {
    return getSignedUrl(
      this.publicSigner,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: opts.downloadName
          ? `attachment; filename="${opts.downloadName.replace(/[^\w.\- ]/g, '_')}"`
          : undefined,
      }),
      { expiresIn },
    );
  }

  /** Presigned GET reachable from inside the Docker network (worker → ffprobe). */
  presignInternalGet(key: string, expiresIn = 600) {
    return getSignedUrl(this.internal, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }

  async head(key: string): Promise<{ size: number; contentType: string; etag: string | null } | null> {
    try {
      const r = await this.internal.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType ?? 'application/octet-stream', etag: r.ETag ?? null };
    } catch (e: any) {
      if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return null;
      throw e;
    }
  }

  async put(key: string, body: Buffer | Uint8Array | string, contentType: string) {
    await this.internal.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  /** Streams a local file (large videos) into the bucket. */
  async putFile(key: string, path: string, contentType: string) {
    const size = statSync(path).size;
    await this.internal.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: createReadStream(path), ContentLength: size, ContentType: contentType }));
    return size;
  }

  async getStream(key: string): Promise<{ body: Readable; contentType: string; size: number } | null> {
    try {
      const r = await this.internal.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return { body: r.Body as Readable, contentType: r.ContentType ?? 'application/octet-stream', size: Number(r.ContentLength ?? 0) };
    } catch (e: any) {
      if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NoSuchKey') return null;
      throw e;
    }
  }

  /** A small text object (captions), or null when it doesn't exist. Refuses objects larger than maxBytes. */
  async getText(key: string, maxBytes = 5 * 1024 * 1024): Promise<{ text: string; etag: string | null } | null> {
    try {
      const r = await this.internal.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (Number(r.ContentLength ?? 0) > maxBytes) throw new Error(`object too large (${r.ContentLength} bytes)`);
      return { text: (await r.Body?.transformToString('utf-8')) ?? '', etag: r.ETag ?? null };
    } catch (e: any) {
      if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NoSuchKey') return null;
      throw e;
    }
  }

  async delete(key: string) {
    await this.internal.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Deletes every object under a prefix (used for superseded HLS packagings). Refuses anything outside hls/<id>/. */
  async deletePrefix(prefix: string): Promise<number> {
    if (!/^hls\/[0-9a-f]{32}\/$/.test(prefix)) throw new Error(`refusing to delete prefix ${prefix}`);
    let token: string | undefined;
    let n = 0;
    do {
      const page = await this.internal.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      const keys = (page.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (keys.length) await this.internal.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } }));
      n += keys.length;
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return n;
  }
}
