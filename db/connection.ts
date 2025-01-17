import { MongoClient, Db, MongoClientOptions } from "mongodb";
import { DatabaseConnectionError } from "./errors";

// Connection configuration
const CONFIG: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 1,
  retryWrites: true,
  writeConcern: { w: 'majority' },
  connectTimeoutMS: 5000,
  serverSelectionTimeoutMS: 5000
};

// Connection management class
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;

  private constructor() {}

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async connect(): Promise<void> {
    if (!process.env.MONGODB_URL) {
      throw new DatabaseConnectionError("MONGODB_URL must be set");
    }

    if (!process.env.MONGODB_NAME) {
      throw new DatabaseConnectionError("MONGODB_NAME must be set");
    }

    try {
      this.client = await MongoClient.connect(process.env.MONGODB_URL, CONFIG);
      this.db = this.client.db(process.env.MONGODB_NAME);
      await this.db.command({ ping: 1 });
      console.log("Successfully connected to MongoDB");
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error("Failed to connect to MongoDB:", error);
      throw new DatabaseConnectionError(
        "Failed to establish MongoDB connection",
        error instanceof Error ? error : undefined
      );
    }
  }

  async getDatabase(): Promise<Db> {
    // Check connection status using ping instead of isConnected
    if (!this.db || !(await this.pingDatabase())) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new DatabaseConnectionError("Maximum reconnection attempts reached");
      }
      console.log("Connection lost, attempting to reconnect...");
      this.reconnectAttempts++;
      await this.connect();
    }
    return this.db!;
  }

  private async pingDatabase(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        this.client = null;
        this.db = null;
        console.log("Disconnected from MongoDB");
      } catch (error) {
        throw new DatabaseConnectionError(
          "Error disconnecting from MongoDB",
          error instanceof Error ? error : undefined
        );
      }
    }
  }
}