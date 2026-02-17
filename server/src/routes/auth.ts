import { Router } from "express";
import { z } from "zod";
import { authenticate, createSession, deleteSession, getUserScope } from "../modules/auth/auth.service";
import { getDb } from "../db";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/login", validateBody(loginSchema), (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = authenticate(email, password);
  if (!user) {
    return res.status(401).json({ error: { code: "unauthorized", message: "Invalid credentials" } });
  }
  const scope = getUserScope(user.id);
  const session = createSession(user.id);
  return res.json({
    data: {
      user,
      scope,
      token: session.token,
      expiresAt: session.expiresAt
    }
  });
});

router.get("/me", requireAuth, (req, res) => {
  const db = getDb();
  const profile = db
    .prepare(
      "SELECT u.email, tp.first_name, tp.last_name FROM users u LEFT JOIN teacher_profiles tp ON tp.user_id = u.id WHERE u.id = ?"
    )
    .get(req.user.id) as { email: string; first_name?: string; last_name?: string } | undefined;
  const scope = getUserScope(req.user.id);
  res.json({ data: { user: { id: req.user.id, email: profile?.email, firstName: profile?.first_name, lastName: profile?.last_name }, scope } });
});

router.post("/logout", requireAuth, (req, res) => {
  const authHeader = req.header("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token) {
    deleteSession(token);
  }
  res.json({ data: { ok: true } });
});

export default router;
