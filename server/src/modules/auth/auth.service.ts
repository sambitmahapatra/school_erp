import crypto from "crypto";
import { getDb } from "../../db";

const SESSION_DAYS = 7;

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith("scrypt$")) {
    return false;
  }
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

export function authenticate(email: string, password: string) {
  const db = getDb();
  const user = db
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ? AND status = 'active'")
    .get(email) as { id: number; email: string; password_hash: string } | undefined;

  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;

  return { id: user.id, email: user.email };
}

export function createSession(userId: number) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  db.prepare(
    "INSERT INTO auth_sessions (user_id, token, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(userId, token, now.toISOString(), expiresAt.toISOString());

  return { token, expiresAt: expiresAt.toISOString() };
}

export function getSession(token: string) {
  const db = getDb();
  const session = db
    .prepare("SELECT user_id, expires_at FROM auth_sessions WHERE token = ?")
    .get(token) as { user_id: number; expires_at: string } | undefined;
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
    return null;
  }
  return { userId: session.user_id };
}

export function deleteSession(token: string) {
  const db = getDb();
  db.prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
}

export function getUserScope(userId: number) {
  const db = getDb();
  const roles = db
    .prepare(
      "SELECT r.name FROM roles r INNER JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?"
    )
    .all(userId) as { name: string }[];

  const assignments = db
    .prepare(
      "SELECT ta.id, ta.class_id, ta.subject_id, ta.assignment_role FROM teacher_assignments ta INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id WHERE tp.user_id = ? AND ta.is_active = 1"
    )
    .all(userId) as { id: number; class_id: number; subject_id: number | null; assignment_role: string }[];

  return {
    roles: roles.map((r) => r.name),
    assignments
  };
}
