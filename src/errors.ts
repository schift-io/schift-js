export class SchiftError extends Error {
  public readonly status?: number;
  public readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "SchiftError";
    this.status = status;
    this.code = code;
  }
}

export class AuthError extends SchiftError {
  constructor(message = "Invalid API key") {
    super(message, 401, "auth_error");
    this.name = "AuthError";
  }
}

export class QuotaError extends SchiftError {
  constructor(message = "Quota exceeded") {
    super(message, 402, "quota_exceeded");
    this.name = "QuotaError";
  }
}

export class EntitlementError extends SchiftError {
  constructor(message = "Upgrade your plan to access this feature") {
    super(message, 403, "entitlement_error");
    this.name = "EntitlementError";
  }
}
