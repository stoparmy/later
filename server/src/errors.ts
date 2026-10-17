import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message = code, public details?: unknown) {
    super(message);
  }
}

export function route(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => handler(req, res).catch(next);
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const known = error instanceof HttpError;
  const status = known ? error.status : 500;
  const code = known ? error.code : "internal_error";
  if (!known) console.error(error);
  res.status(status).json({ error: code });
}
