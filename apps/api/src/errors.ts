import type { FastifyReply } from "fastify";

export const sendError = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string
) => {
  return reply.status(statusCode).send({
    code,
    message
  });
};

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
  }
}
