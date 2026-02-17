import type { NextFunction, Request, Response } from "express";
import { getSessionUser, type SessionUser } from "./sessions";

export type AuthedRequest = Request & { user: SessionUser };

function bearerToken(req: Request) {
  const auth = req.header("authorization") ?? req.header("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return m[1]?.trim() || null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing Bearer token" });

    const user = await getSessionUser(token);
    if (!user) return res.status(401).json({ error: "Invalid or expired token" });
    (req as AuthedRequest).user = user;
    return next();
  } catch (err: any) {
    return res.status(401).json({ error: err?.message ?? "Invalid token" });
  }
}
