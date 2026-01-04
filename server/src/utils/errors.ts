export class UnauthorizedUserError extends Error {
  status: number;

  constructor(message = 'Unauthorized user') {
    super(message);
    this.status = 401;
  }
}
