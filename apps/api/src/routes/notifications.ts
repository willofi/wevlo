import type { FastifyPluginAsync } from "fastify";
import {
  notificationIdsRequestSchema,
  notificationListQuerySchema,
  notificationSummarySchema,
  notificationListResponseSchema,
  notificationPreferenceSchema,
  updateNotificationPreferencesRequestSchema,
} from "@wevlo/contracts";

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/notification-preferences", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const preferences = await fastify.notificationRepository.getPreferences(currentUser.id);
    return reply.send(notificationPreferenceSchema.parse(preferences));
  });

  fastify.put("/notification-preferences", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const payload = updateNotificationPreferencesRequestSchema.parse(request.body);
    const preferences = await fastify.notificationRepository.savePreferences(currentUser.id, payload);
    return reply.send(notificationPreferenceSchema.parse(preferences));
  });

  fastify.get("/notifications/summary", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const summary = await fastify.notificationRepository.listSummary(currentUser.id);
    return reply.send(notificationSummarySchema.parse(summary));
  });

  fastify.get("/notifications", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const query = notificationListQuerySchema.parse(request.query);
    const notifications = await fastify.notificationRepository.listNotifications({
      ...(query.category ? { category: query.category } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      status: query.status,
      userId: currentUser.id,
      ...(query.workspaceId ? { workspaceId: query.workspaceId } : {})
    });

    return reply.send(notificationListResponseSchema.parse(notifications));
  });

  fastify.post("/notifications/seen", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const payload = notificationIdsRequestSchema.parse(request.body);
    await fastify.notificationRepository.markSeen(currentUser.id, payload.ids);
    return reply.status(204).send();
  });

  fastify.post("/notifications/read", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const payload = notificationIdsRequestSchema.parse(request.body);
    await fastify.notificationRepository.markRead(currentUser.id, payload.ids);
    return reply.status(204).send();
  });

  fastify.post("/notifications/archive", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const payload = notificationIdsRequestSchema.parse(request.body);
    await fastify.notificationRepository.archive(currentUser.id, payload.ids);
    return reply.status(204).send();
  });

  fastify.post("/notifications/read-all", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    await fastify.notificationRepository.markAllRead(currentUser.id);
    return reply.status(204).send();
  });
};

export default notificationRoutes;
