# API Deploy (Mac mini + Supabase)

This project deploys API with GitHub Actions to a Mac mini host and runs DB migrations before rollout.

## GitHub Secrets

Add these repository secrets:

- `DATABASE_URL`: Supabase Postgres connection string (with `sslmode=require`)
- `WEVLO_INTERNAL_AUTH_TOKEN`: internal BFF/API token
- `GHCR_USERNAME`: GitHub Container Registry username
- `GHCR_TOKEN`: GitHub Container Registry token (read/write packages)
- `MAC_HOST`: Mac mini SSH host (Tailscale hostname or IP)
- `MAC_USER`: Mac mini SSH user
- `MAC_SSH_KEY`: private SSH key for the Mac mini user

## Mac mini runtime files

Create `/opt/wevlo/deploy/.env.production` on the Mac mini:

```env
DATABASE_URL=postgresql://...
WEVLO_INTERNAL_AUTH_TOKEN=...
ALLOW_DEV_AUTH=false

WEVLO_STORAGE_DRIVER=supabase_s3
WEVLO_S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
WEVLO_S3_REGION=ap-northeast-2
WEVLO_S3_ACCESS_KEY_ID=...
WEVLO_S3_SECRET_ACCESS_KEY=...
WEVLO_S3_BUCKET=wevlo-attachments

WEVLO_API_BASE_URL=http://127.0.0.1:4000
WEVLO_ATTACHMENT_STORAGE_DIR=/opt/wevlo/data/attachments
NEXTAUTH_URL=https://<your-web-domain>
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

Notes:

- `IMAGE_TAG` and `GHCR_REPOSITORY` are auto-managed by the deploy workflow.
- `WEVLO_ATTACHMENT_STORAGE_DIR` is only used when `WEVLO_STORAGE_DRIVER=local`.

## Deploy flow

`main` branch push triggers `.github/workflows/deploy-api.yml`:

1. `pnpm install`
2. run `pnpm --filter @wevlo/data-access migrate` twice (idempotency check)
3. build and push `ghcr.io/<repo>/api:<sha>`
4. copy compose template to Mac mini
5. update `IMAGE_TAG` and restart API container
