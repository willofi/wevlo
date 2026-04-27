FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @wevlo/api build
# apps/api와 필요한 의존성만 /app/pruned로 추출
RUN pnpm --filter @wevlo/api --prod deploy /app/pruned

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

# pnpm deploy로 추출된 내용 복사 (이미 빌드된 dist 포함)
COPY --from=build /app/pruned .

EXPOSE 4000

# pnpm deploy는 해당 패키지의 root 구조로 복사하므로 dist/main.js를 실행
CMD ["node", "dist/main.js"]
