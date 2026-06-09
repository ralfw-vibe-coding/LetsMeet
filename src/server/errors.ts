export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export const notFound = () => new AppError("not_found", "Meeting not found", 404);
export const forbidden = (message = "Forbidden") => new AppError("forbidden", message, 403);
export const validation = (message: string) => new AppError("validation_error", message, 400);
