import { Response, NextFunction } from "express";
import { AuthedRequest } from "./types";

export function requirePermission(permission: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: "unauthorized", message: "Not authenticated" } });
    }
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: { code: "forbidden", message: "Insufficient permission" } });
    }
    return next();
  };
}
