import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const defaultStorageDir = join(process.cwd(), ".wevlo-attachments");

export type StoredAttachment = {
  byteSize: number;
  checksum: string;
  storageKey: string;
};

export type AttachmentStorage = {
  put: (input: {
    buffer: Buffer;
    contentType: string;
  }) => Promise<StoredAttachment>;
  stream: (storageKey: string) => Promise<NodeJS.ReadableStream>;
  delete: (storageKey: string) => Promise<void>;
};

export class LocalAttachmentStorage implements AttachmentStorage {
  constructor(private readonly storageDir = process.env.WEVLO_ATTACHMENT_STORAGE_DIR ?? defaultStorageDir) {}

  async put(input: {
    buffer: Buffer;
    contentType: string;
  }): Promise<StoredAttachment> {
    void input.contentType;
    await mkdir(this.storageDir, { recursive: true });

    const storageKey = randomUUID();
    const checksum = createHash("sha256").update(input.buffer).digest("hex");
    await writeFile(join(this.storageDir, storageKey), input.buffer);

    return {
      byteSize: input.buffer.byteLength,
      checksum,
      storageKey
    };
  }

  async stream(storageKey: string): Promise<NodeJS.ReadableStream> {
    return createReadStream(join(this.storageDir, storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(join(this.storageDir, storageKey));
    } catch {
      // Metadata deletion is authoritative; missing local bytes should not fail the request.
    }
  }
}
