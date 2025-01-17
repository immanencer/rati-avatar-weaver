import { Collection, Document } from "mongodb";
import { DatabaseConnection } from "./connection";
import { DatabaseOperationError } from "./errors";

export class DatabaseOperations {
  private static instance: DatabaseOperations;
  private connection: DatabaseConnection;

  private constructor() {
    this.connection = DatabaseConnection.getInstance();
  }

  static getInstance(): DatabaseOperations {
    if (!DatabaseOperations.instance) {
      DatabaseOperations.instance = new DatabaseOperations();
    }
    return DatabaseOperations.instance;
  }

  async getCollection<T extends Document>(collectionName: string): Promise<Collection<T>> {
    try {
      const db = await this.connection.getDatabase();
      return db.collection<T>(collectionName);
    } catch (error) {
      throw new DatabaseOperationError(
        `Failed to get collection: ${collectionName}`,
        'getCollection',
        error instanceof Error ? error : undefined
      );
    }
  }

  async ping(): Promise<boolean> {
    try {
      const db = await this.connection.getDatabase();
      await db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }
}