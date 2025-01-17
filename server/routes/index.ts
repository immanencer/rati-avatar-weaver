import type { Express } from "express";
import { createServer, type Server } from "http";
import WebSocket from "ws";
import express from "express";
import { arweaveRoutes } from "./arweave.routes";
import { solanaRoutes } from "./solana.routes";
import { avatarRoutes } from "./avatars.routes";

export function registerRoutes(app: Express): Server {
  const router = express.Router();

  // Mount feature-specific routes
  router.use("/arweave", arweaveRoutes);
  router.use("/solana", solanaRoutes);
  router.use("/avatars", avatarRoutes);

  // Mount all routes under /api
  app.use("/api", router);

  // Create HTTP server
  const httpServer = createServer(app);

  // Initialize WebSocket server
  const wss = new WebSocket.Server({
    server: httpServer,
    path: "/ws",
  });

  wss.on("connection", (ws: WebSocket) => {
    console.log("New WebSocket connection established");

    ws.on("message", (message: WebSocket.Data) => {
      try {
        console.log("Received:", message.toString());
      } catch (error) {
        console.error("Error processing message:", error);
      }
    });

    ws.on("error", (error: Error) => {
      console.error("WebSocket error:", error);
    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });
  });

  return httpServer;
}

export * from "./arweave.routes";
export * from "./solana.routes";
export * from "./avatars.routes";
