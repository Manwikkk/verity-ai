import type { FastifyInstance } from "fastify";
import { googleAuthSchema, loginSchema, registerSchema } from "../schemas/auth.schema.js";
import * as authService from "../services/auth.service.js";

export async function authRoutes(app: FastifyInstance) {
  /** POST /google — Google Sign-In */
  app.post("/google", async (request, reply) => {
    const body = googleAuthSchema.parse(request.body);
    const result = await authService.googleAuth(body.idToken, request.ip);
    reply.send(result);
  });

  /** POST /register — Email/password registration */
  app.post("/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.registerUser(body.email, body.password, body.name, request.ip);
    reply.status(201).send(result);
  });

  /** POST /login — Email/password login */
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.loginUser(body.email, body.password, request.ip);
    reply.send(result);
  });

  /** POST /guest — Guest session */
  app.post("/guest", async (request, reply) => {
    const result = await authService.createGuestSession(request.ip);
    reply.send(result);
  });
}
