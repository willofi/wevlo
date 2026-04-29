import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";

import { runWithDbQueryMetrics, type Database, type DbQueryMetrics } from "@wevlo/data-access";
import {
  IssueAlreadyExistsError,
  IssueMutationNotAllowedError,
  IssueNotFoundError,
  IssueTransitionNotAllowedError,
  IssueTriageStatusError,
} from "@wevlo/issues";
import type { ErrorEnvelopeDto } from "@wevlo/contracts";

import contextPlugin from "./plugins/context.js";
import healthRoutes from "./routes/health.js";
import internalAuthRoutes from "./routes/internal-auth.js";
import meRoutes from "./routes/me.js";
import integrationRoutes from "./routes/integrations.js";
import notificationRoutes from "./routes/notifications.js";
import workspaceRoutes from "./routes/workspaces.js";
import projectRoutes from "./routes/projects.js";
import issueRoutes from "./routes/issues.js";
import workspaceInvitationRoutes from "./routes/workspace-invitations.js";
import { UnauthorizedError } from "./errors.js";

export type ApiDependencies = {
  database: Database;
};

const DEFAULT_HTTP_LOG_MIN_MS = 300;

const resolveHttpLogMinMs = (): number => {
  const raw = process.env.WEVLO_HTTP_LOG_MIN_MS;
  if (!raw) {
    return DEFAULT_HTTP_LOG_MIN_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_HTTP_LOG_MIN_MS;
  }

  return parsed;
};

export const buildApi = ({ database }: ApiDependencies) => {
  const httpLogMinMs = resolveHttpLogMinMs();
  const app = Fastify({
    logger: true
  });

  app.addHook("onRequest", (request, _reply, done) => {
    const metrics: DbQueryMetrics = {
      queryCount: 0,
      slowQueryCount: 0,
      totalDurationMs: 0
    };

    (request as any).__dbQueryMetrics = metrics;
    (request as any).__perfStartNs = process.hrtime.bigint();
    runWithDbQueryMetrics(metrics, done);
  });

  app.addHook("onResponse", async (request, reply) => {
    const startNs = (request as any).__perfStartNs;
    if (typeof startNs !== "bigint") {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    const route = request.routeOptions.url;
    const dbMetrics = (request as any).__dbQueryMetrics as DbQueryMetrics | undefined;

    if (dbMetrics && route && (route.includes("/issues") || route.includes("/board") || route.includes("/notifications"))) {
      request.log.info({
        tag: "perf.db.request",
        method: request.method,
        route,
        slowQueryCount: dbMetrics.slowQueryCount,
        totalDbDurationMs: Number(dbMetrics.totalDurationMs.toFixed(1)),
        totalQueryCount: dbMetrics.queryCount
      }, "Request DB metrics");
    }

    if (durationMs < httpLogMinMs) {
      return;
    }

    request.log.warn({
      tag: "perf.http.slow",
      method: request.method,
      url: request.url,
      route,
      statusCode: reply.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      thresholdMs: httpLogMinMs
    }, "Slow request detected");
  });

  // 1. Register Core Plugins
  app.register(cors, {
    allowedHeaders: ["content-type", "x-dev-user-id"],
    origin: true
  });
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1
    }
  });

  // 2. Register Shared Context Plugin
  app.register(contextPlugin, { database });

  // 3. Register Global Routes (Not under /api/v1)
  app.register(healthRoutes, { prefix: "/health" });
  app.register(internalAuthRoutes, { prefix: "/internal/auth" });

  // 4. Register Public API Routes (Under /api/v1)
  app.register(async (v1) => {
    v1.register(meRoutes);
    v1.register(integrationRoutes, { prefix: "/integrations" });
    v1.register(notificationRoutes);
    v1.register(workspaceRoutes, { prefix: "/workspaces" });
    v1.register(workspaceInvitationRoutes);
    v1.register(projectRoutes);
    v1.register(issueRoutes);
  }, { prefix: "/api/v1" });

  // 5. Global Error Handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof UnauthorizedError) {
      return reply.status(401).send({
        code: "auth.unauthorized",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    if (error instanceof ZodError) {
      const message = error.message || "Validation failed";
      return reply.status(400).send({
        code: "validation.failed",
        message
      } satisfies ErrorEnvelopeDto);
    }

    if (error instanceof IssueNotFoundError) {
      return reply.status(404).send({
        code: "issue.not_found",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    if (error instanceof IssueMutationNotAllowedError) {
      return reply.status(409).send({
        code: "issue.mutation_not_allowed",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    if (error instanceof IssueAlreadyExistsError) {
      return reply.status(409).send({
        code: "issue.already_exists",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    if (error instanceof IssueTransitionNotAllowedError) {
      return reply.status(400).send({
        code: "issue.transition_not_allowed",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    if (error instanceof IssueTriageStatusError) {
      return reply.status(400).send({
        code: "issue.invalid_triage_status",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    app.log.error(error);

    return reply.status(500).send({
      code: "internal_error",
      message: error instanceof Error ? error.message : "Unexpected server error",
      stack: error instanceof Error ? error.stack : undefined
    } as any);
  });

  return app;
};
