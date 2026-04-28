import type { FastifyPluginAsync } from "fastify";
import {
  createVerificationTokenRequestSchema,
  verifyTokenRequestSchema,
  createUserRequestSchema,
  linkAccountRequestSchema,
} from "@wevlo/contracts";
import { UnauthorizedError } from "../errors.js";

const internalAuthRoutes: FastifyPluginAsync = async (fastify) => {
  const validateInternalAuth = (request: any) => {
    const token = request.headers["x-wevlo-internal-auth-token"];
    if (!token || token !== process.env.WEVLO_INTERNAL_AUTH_TOKEN) {
      throw new UnauthorizedError("Invalid internal auth token");
    }
  };

  fastify.get("/users/by-email/:email", async (request, reply) => {
    validateInternalAuth(request);
    const params = request.params as { email: string };
    const user = await fastify.identityRepository.findUserByEmail(params.email);
    return user ? reply.send(user) : reply.status(404).send();
  });

  fastify.get("/users/by-identity/:provider/:providerUserId", async (request, reply) => {
    validateInternalAuth(request);
    const params = request.params as { provider: string; providerUserId: string };
    const user = await fastify.identityRepository.findUserByIdentity(params.provider as any, params.providerUserId);
    return user ? reply.send(user) : reply.status(404).send();
  });

  fastify.get("/users/:id", async (request, reply) => {
    validateInternalAuth(request);
    const params = request.params as { id: string };
    const user = await fastify.identityRepository.findUserById(params.id);
    return user ? reply.send(user) : reply.status(404).send();
  });

  fastify.post("/users", async (request, reply) => {
    validateInternalAuth(request);
    const payload = createUserRequestSchema.parse(request.body);

    const existingByEmail = await fastify.identityRepository.findUserByEmail(payload.email);
    if (existingByEmail) {
      const linkedUser = await fastify.identityRepository.upsertIdentityForUser({
        email: payload.email,
        provider: "email",
        providerUserId: payload.email,
        userId: existingByEmail.id
      });
      return reply.send(linkedUser);
    }

    const existingByIdentity = await fastify.identityRepository.findUserByIdentity("email", payload.email);
    if (existingByIdentity) {
      return reply.send(existingByIdentity);
    }

    const user = await fastify.identityRepository.createUserWithIdentity({
      email: payload.email,
      name: payload.name ?? "",
      provider: "email",
      providerUserId: payload.email
    });
    
    return reply.status(201).send(user);
  });

  fastify.post("/users/link", async (request, reply) => {
    validateInternalAuth(request);
    const payload = linkAccountRequestSchema.parse(request.body);

    const user = await fastify.identityRepository.upsertIdentityForUser({
      email: payload.email ?? null,
      provider: payload.provider as any,
      providerUserId: payload.providerUserId,
      userId: payload.userId
    });

    return reply.send(user);
  });

  fastify.post("/verification-tokens", async (request, reply) => {
    validateInternalAuth(request);
    const payload = createVerificationTokenRequestSchema.parse(request.body);
    const token = await fastify.authRepository.createVerificationToken(payload);
    return reply.status(201).send(token);
  });

  fastify.post("/verification-tokens/verify", async (request, reply) => {
    validateInternalAuth(request);
    const payload = verifyTokenRequestSchema.parse(request.body);
    const token = await fastify.authRepository.useVerificationToken(payload.identifier, payload.token);
    return token ? reply.send(token) : reply.status(404).send();
  });
};

export default internalAuthRoutes;
