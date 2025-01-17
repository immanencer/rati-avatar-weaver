import { DatabaseConnection } from "./connection";
import { DatabaseOperations } from "./operations";
export * from "./errors";

// Initialize singleton instances
const connection = DatabaseConnection.getInstance();
const operations = DatabaseOperations.getInstance();

// Export database interface
export const db = {
  connect: () => connection.connect(),
  disconnect: () => connection.disconnect(),
  getDB: () => connection.getDatabase(),
  operations,
};

// Export specific operations for direct access
export const getDB = () => connection.getDatabase();
export const ping = () => operations.ping();