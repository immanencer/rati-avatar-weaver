import type { Express } from "express";
import { createServer, type Server } from "http";
import { avatarRoutes } from "./routes/avatars.routes";
import express from "express";
import { db } from "@db";

export function registerRoutes(app: Express): Server {
  const router = express.Router();

  // Mount routes
  router.use("/avatars", avatarRoutes);

  // Mount all routes under /api
  app.use("/api", router);

  return createServer(app);
}