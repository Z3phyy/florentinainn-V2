import { Request, Response, NextFunction } from "express";

export const attachTokenFromQuery = (request: Request, response: Response, next: NextFunction) => {
  const token = request.query.token as string | undefined;
  if (token) {
    request.headers.authorization = `Bearer ${token}`;
  }
  next();
};