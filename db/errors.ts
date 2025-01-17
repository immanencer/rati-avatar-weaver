// Custom database errors for better error handling
export class DatabaseConnectionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

export class DatabaseOperationError extends Error {
  constructor(message: string, public readonly operation: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseOperationError';
  }
}

export class DatabaseTimeoutError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = 'DatabaseTimeoutError';
  }
}
