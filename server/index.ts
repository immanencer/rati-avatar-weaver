import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { MongoClient } from "mongodb";
import "./worker"; // Import worker to start processing uploads

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize MongoDB connection
let dbClient: MongoClient | null = null;

async function initMongoDB() {
  if (!process.env.MONGODB_URL) {
    throw new Error("MONGODB_URL is required");
  }

  try {
    dbClient = new MongoClient(process.env.MONGODB_URL);
    await dbClient.connect();
    log("Successfully connected to MongoDB");
    return dbClient;
  } catch (error) {
    log(
      `Failed to connect to MongoDB: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    throw error;
  }
}

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Initialize MongoDB first
    await initMongoDB();

    // Register routes after MongoDB connection is established
    const server = registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    // Setup Vite or static serving
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start server
    const port = 5000;
    server.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port}`);
    });
  } catch (error) {
    log(
      `Failed to initialize application: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    process.exit(1);
  }
})();

// Graceful shutdown
process.on("SIGTERM", async () => {
  if (dbClient) {
    await dbClient.close();
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  if (dbClient) {
    await dbClient.close();
  }
  process.exit(0);
});