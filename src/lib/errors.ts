export class ApiError extends Error {
  statusCode: number;
  details?: any;
  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const errorResponse = (err: any) => {
  if (err instanceof ApiError) {
    return { status: err.statusCode, body: { error: { code: err.name, message: err.message, details: err.details } } };
  }
  console.error(err);
  return { status: 500, body: { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' } } };
};
