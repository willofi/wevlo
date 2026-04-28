import type { FastifyPluginAsync } from "fastify";
import {
  handleAvailabilityQuerySchema,
  handleAvailabilitySchema,
  meSchema,
  myIssuesQuerySchema,
  myIssuesResponseSchema,
  sessionSchema,
  updateProfileRequestSchema,
} from "@wevlo/contracts";
import {
  listVisibleWorkspacesUseCase,
  UserHandleTakenError,
} from "@wevlo/identity-tenancy";
import { sendError } from "../errors.js";

const meRoutes: FastifyPluginAsync = async (fastify) => {
  const profileAvatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const maxProfileAvatarBytes = 5 * 1024 * 1024;
  const buildProfileAvatarUrl = (userId: string) => `/api/bff/users/${userId}/avatar`;

  fastify.get("/session", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const userId = currentUser.id;
    const workspaces = await listVisibleWorkspacesUseCase(fastify.workspaceRepository, userId);
    const payload = sessionSchema.parse({
      defaultWorkspaceSlug: workspaces[0]?.slug ?? null,
      email: currentUser.email,
      name: currentUser.name,
      userId,
      workspaceIds: workspaces.map((workspace) => workspace.id)
    });

    return reply.send(payload);
  });

  fastify.get("/me", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const workspaceMemberships = await fastify.identityRepository.listMembershipsForUser(currentUser.id);
    const projectMemberships = await fastify.projectCollaborationRepository.listMembershipsForUser(currentUser.id);

    return reply.send(
      meSchema.parse({
        projectMemberships,
        user: currentUser,
        workspaceMemberships
      })
    );
  });

  fastify.get("/me/handle-availability", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const query = handleAvailabilityQuerySchema.parse(request.query);
    const available = await fastify.identityRepository.isHandleAvailable(query.handle, currentUser.id);

    return reply.send(
      handleAvailabilitySchema.parse({
        available,
        handle: query.handle
      })
    );
  });

  fastify.patch("/me/profile", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const payload = updateProfileRequestSchema.parse(request.body);

    try {
      const updatedUser = await fastify.identityRepository.updateProfile({
        ...(payload.avatarUrl !== undefined ? { avatarUrl: payload.avatarUrl } : {}),
        ...(payload.handle !== undefined ? { handle: payload.handle } : {}),
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        userId: currentUser.id
      });

      return reply.send(updatedUser);
    } catch (error) {
      if (error instanceof UserHandleTakenError) {
        return sendError(reply, 409, "me.handle_taken", error.message);
      }

      throw error;
    }
  });

  fastify.post("/me/profile/avatar", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const upload = await request.file();

    if (!upload) {
      return sendError(reply, 400, "profile.avatar_required", "Profile image file is required");
    }

    const contentType = upload.mimetype.trim().toLowerCase();

    if (!profileAvatarMimeTypes.has(contentType)) {
      return sendError(reply, 400, "profile.avatar_invalid_type", "Profile image must be a PNG, JPG, WEBP, or GIF");
    }

    const buffer = await upload.toBuffer();

    if (buffer.byteLength === 0) {
      return sendError(reply, 400, "profile.avatar_empty", "Profile image file is empty");
    }

    if (buffer.byteLength > maxProfileAvatarBytes) {
      return sendError(reply, 400, "profile.avatar_too_large", "Profile image must be 5 MB or smaller");
    }

    const stored = await fastify.attachmentStorage.put({
      buffer,
      contentType,
      keyPrefix: `profiles/${currentUser.id}`
    });

    const previousStorageKey = currentUser.avatarStorageKey;

    try {
      const updatedUser = await fastify.identityRepository.updateProfile({
        avatarContentType: contentType,
        avatarStorageKey: stored.storageKey,
        avatarUrl: buildProfileAvatarUrl(currentUser.id),
        userId: currentUser.id
      });

      if (previousStorageKey && previousStorageKey !== stored.storageKey) {
        await fastify.attachmentStorage.delete(previousStorageKey);
      }

      return reply.status(201).send(updatedUser);
    } catch (error) {
      await fastify.attachmentStorage.delete(stored.storageKey);
      throw error;
    }
  });

  fastify.delete("/me/profile/avatar", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const previousStorageKey = currentUser.avatarStorageKey;

    const updatedUser = await fastify.identityRepository.updateProfile({
      avatarContentType: null,
      avatarStorageKey: null,
      avatarUrl: null,
      userId: currentUser.id
    });

    if (previousStorageKey) {
      await fastify.attachmentStorage.delete(previousStorageKey);
    }

    return reply.send(updatedUser);
  });

  fastify.get("/users/:userId/avatar", async (request, reply) => {
    await fastify.resolveCurrentUser(request);
    const params = request.params as { userId: string };
    const user = await fastify.identityRepository.findUserById(params.userId);

    if (!user?.avatarStorageKey) {
      return sendError(reply, 404, "profile.avatar_not_found", "Profile image not found");
    }

    if (user.avatarContentType) {
      reply.header("content-type", user.avatarContentType);
    }

    const avatarStream = await fastify.attachmentStorage.stream(user.avatarStorageKey);
    return reply.send(avatarStream);
  });

  fastify.get("/me/issues", async (request, reply) => {
    const currentUser = await fastify.resolveCurrentUser(request);
    const query = myIssuesQuerySchema.parse(request.query);
    const { project, workspace } = await fastify.resolvePersonalIssueFilters(currentUser.id, query);

    if (query.workspaceSlug && !workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (query.projectKey && !project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    const items = await fastify.issueRepository.listPersonalIssues({
      ...(project ? { projectId: project.id } : {}),
      tab: query.tab,
      userId: currentUser.id,
      ...(workspace ? { workspaceId: workspace.id } : {})
    });

    return reply.send(myIssuesResponseSchema.parse({ items }));
  });
};

export default meRoutes;
