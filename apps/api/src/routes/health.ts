import type { FastifyPluginAsync } from "fastify";
import { healthcheckDatabase } from "@wevlo/data-access";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (_request, reply) => {
    await healthcheckDatabase(fastify.database);
    return reply.send({ status: "ok" });
  });
};

export default healthRoutes;
