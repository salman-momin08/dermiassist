
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

// A custom error class to capture Firestore permission error context
export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules.`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
    
    // This is to make the error object serializable for the dev overlay
    Object.setPrototypeOf(this, FirestorePermissionError.prototype);
  }
}
