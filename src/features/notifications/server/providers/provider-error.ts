export class NotificationProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly permanent: boolean,
  ) {
    super(message);
    this.name = "NotificationProviderError";
  }
}
