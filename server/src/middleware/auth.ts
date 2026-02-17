import { Request, Response, NextFunction } from "express";
import { getDb } from "../db";
import { getSession } from "../modules/auth/auth.service";


export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.header("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({ error: { code: "unauthorized", message: "Missing token" } });
    }

    const session = await getSession(token);
    if (!session) {
      return res.status(401).json({ error: { code: "unauthorized", message: "Invalid or expired token" } });
    }

    const userId = session.userId;
    const db = getDb();

    const user = (await db.prepare("SELECT id, email FROM users WHERE id = ?").get(userId)) as
      | { id: number; email: string }
      | undefined;

    if (!user) {
      return res.status(401).json({ error: { code: "unauthorized", message: "User not found" } });
    }

    const roleRows = (await db
      .prepare("SELECT r.name FROM roles r INNER JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?")
      .all(userId)) as { name: string }[];
    const roleNames = roleRows.map((r) => r.name);

    const permRows = (await db
      .prepare(
        "SELECT p.name FROM permissions p INNER JOIN role_permissions rp ON rp.permission_id = p.id INNER JOIN user_roles ur ON ur.role_id = rp.role_id WHERE ur.user_id = ?"
      )
      .all(userId)) as { name: string }[];
    const permissions = Array.from(new Set(permRows.map((p) => p.name)));

    const teacher = (await db.prepare("SELECT id FROM teacher_profiles WHERE user_id = ?").get(userId)) as
      | { id: number }
      | undefined;

    req.user = {
      id: user.id,
      roleNames,
      permissions,
      teacherId: teacher?.id ?? null
    };

    next();
  } catch (err) {
    next(err);
  }
}
