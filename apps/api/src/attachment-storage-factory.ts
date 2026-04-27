import type { AttachmentStorage } from "./attachment-storage";
import { LocalAttachmentStorage } from "./attachment-storage";
import { SupabaseS3AttachmentStorage } from "./supabase-s3-attachment-storage";

type AttachmentStorageDriver = "local" | "supabase_s3";

const getNonEmptyEnv = (name: string): string | null => {
  const value = process.env[name];
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const requireEnv = (name: string): string => {
  const value = getNonEmptyEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const getStorageDriver = (): AttachmentStorageDriver => {
  const configured = getNonEmptyEnv("WEVLO_STORAGE_DRIVER");

  if (!configured) {
    return "local";
  }

  if (configured === "local" || configured === "supabase_s3") {
    return configured;
  }

  throw new Error(
    `Unsupported WEVLO_STORAGE_DRIVER value: ${configured}. Expected one of: local, supabase_s3`
  );
};

export const createAttachmentStorageFromEnv = (): AttachmentStorage => {
  const driver = getStorageDriver();

  if (driver === "local") {
    return new LocalAttachmentStorage();
  }

  return new SupabaseS3AttachmentStorage({
    accessKeyId: requireEnv("WEVLO_S3_ACCESS_KEY_ID"),
    bucket: requireEnv("WEVLO_S3_BUCKET"),
    endpoint: requireEnv("WEVLO_S3_ENDPOINT"),
    region: requireEnv("WEVLO_S3_REGION"),
    secretAccessKey: requireEnv("WEVLO_S3_SECRET_ACCESS_KEY")
  });
};
