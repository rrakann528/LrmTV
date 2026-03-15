import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || 'lrmtv_jwt_fallback_secret_2025_please_set_in_env';

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
    req.userId = payload.userId;
    req.username = payload.username;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
      req.userId = payload.userId;
      req.username = payload.username;
    } catch { /* ignore */ }
  }
  next();
}

export function signToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: "30d" });
}
