FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
RUN corepack enable

FROM base AS build
WORKDIR /app

# 의존성 설치에 필요한 파일들만 먼저 복사
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

# 모든 소스 코드 복사 (tsx 실행을 위해 필요)
COPY . .

# 배포용 패키지 추출 (내부 의존성 포함)
RUN pnpm --filter @wevlo/api --prod deploy /app/pruned

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

# 추출된 파일 복사
COPY --from=build /app/pruned .

EXPOSE 4000

# tsx를 사용하여 소스를 직접 실행 (모듈 해석 문제 완벽 해결)
CMD ["pnpm", "start"]
