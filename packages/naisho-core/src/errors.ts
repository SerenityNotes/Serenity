export class NaishoSnapshotBasedOnOutdatedSnapshotError extends Error {
  constructor(message) {
    super(message);

    this.name = this.constructor.name;

    // capturing the stack trace keeps the reference to your error class
    // https://github.com/microsoft/TypeScript/issues/1168#issuecomment-219296751
    this.stack = new Error().stack;
  }
}

export class NaishoSnapshotMissesUpdatesError extends Error {
  constructor(message) {
    super(message);

    this.name = this.constructor.name;

    // capturing the stack trace keeps the reference to your error class
    // https://github.com/microsoft/TypeScript/issues/1168#issuecomment-219296751
    this.stack = new Error().stack;
  }
}

export class NaishoNewSnapshotRequiredError extends Error {
  constructor(message) {
    super(message);

    this.name = this.constructor.name;

    // capturing the stack trace keeps the reference to your error class
    // https://github.com/microsoft/TypeScript/issues/1168#issuecomment-219296751
    this.stack = new Error().stack;
  }
}

export class NaishoProcessingEphemeralUpdateError extends Error {
  originalError: Error;

  constructor(message, originalError: Error) {
    super(message);

    this.name = this.constructor.name;
    this.originalError = originalError;

    // capturing the stack trace keeps the reference to your error class
    // https://github.com/microsoft/TypeScript/issues/1168#issuecomment-219296751
    this.stack = new Error().stack;
  }
}
