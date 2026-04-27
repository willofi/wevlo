import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

import type { AttachmentStorage, StoredAttachment } from "./attachment-storage.js";

type SupabaseS3AttachmentStorageOptions = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  region: string;
  secretAccessKey: string;
};

const toReadableStream = async (body: unknown): Promise<NodeJS.ReadableStream> => {
  if (!body) {
    throw new Error("Attachment object body is empty");
  }

  if (body instanceof Readable) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Readable.from([body]);
  }

  const blobLike = body as {
    stream?: () => ReadableStream<Uint8Array>;
  };
  if (typeof blobLike.stream === "function") {
    return Readable.fromWeb(blobLike.stream());
  }

  const streamLike = body as {
    transformToWebStream?: () => Promise<ReadableStream<Uint8Array>> | ReadableStream<Uint8Array>;
  };
  if (typeof streamLike.transformToWebStream === "function") {
    const webStream = await streamLike.transformToWebStream();
    return Readable.fromWeb(webStream);
  }

  throw new Error("Unsupported attachment object stream type");
};

export class SupabaseS3AttachmentStorage implements AttachmentStorage {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(options: SupabaseS3AttachmentStorageOptions) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey
      },
      endpoint: options.endpoint,
      forcePathStyle: true,
      region: options.region
    });
  }

  async put(input: {
    buffer: Buffer;
    contentType: string;
  }): Promise<StoredAttachment> {
    const storageKey = randomUUID();
    const checksum = createHash("sha256").update(input.buffer).digest("hex");

    await this.client.send(
      new PutObjectCommand({
        Body: input.buffer,
        Bucket: this.bucket,
        ContentType: input.contentType,
        Key: storageKey
      })
    );

    return {
      byteSize: input.buffer.byteLength,
      checksum,
      storageKey
    };
  }

  async stream(storageKey: string): Promise<NodeJS.ReadableStream> {
    const output = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey
      })
    );

    return toReadableStream(output.Body);
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey
      })
    );
  }
}
