FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
RUN corepack enable

FROM base AS build
WORKDIR /app

# Install dependencies with a stable cache key first.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY apps/api/package.json ./apps/api/
COPY packages/audit-activity/package.json ./packages/audit-activity/
COPY packages/auth/package.json ./packages/auth/
COPY packages/authz/package.json ./packages/authz/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/core/package.json ./packages/core/
COPY packages/data-access/package.json ./packages/data-access/
COPY packages/identity-tenancy/package.json ./packages/identity-tenancy/
COPY packages/integrations/package.json ./packages/integrations/
COPY packages/issues/package.json ./packages/issues/
COPY packages/notifications/package.json ./packages/notifications/
COPY packages/projections-search/package.json ./packages/projections-search/
COPY packages/projects/package.json ./packages/projects/
COPY packages/test-kit/package.json ./packages/test-kit/
COPY packages/ui-core/package.json ./packages/ui-core/

RUN pnpm install --frozen-lockfile

# Copy the full repo only after dependencies are installed.
COPY . .

# Build the API and its workspace dependencies before pruning.
RUN pnpm turbo run build --filter=@wevlo/api...

# Extract a production-only runtime tree.
RUN pnpm --filter @wevlo/api --prod deploy /app/pruned

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/pruned .

EXPOSE 4000

CMD ["node", "dist/main.js"]
