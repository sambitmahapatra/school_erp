import { Router } from "express";
import { z } from "zod";
import { authenticate, createSession, deleteSession, getUserScope } from "../modules/auth/auth.service";
import { getDb } from "../db";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/login", validateBody(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = await authenticate(email, password);
  if (!user) {
    return res.status(401).json({ error: { code: "unauthorized", message: "Invalid credentials" } });
  }
  const scope = await getUserScope(user.id);
  const session = await createSession(user.id);
  return res.json({
    data: {
      user,
      scope,
      token: session.token,
      expiresAt: session.expiresAt
    }
  });
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const db = getDb();
  const profile = (await db
    .prepare(
      "SELECT u.email, tp.first_name, tp.last_name FROM users u LEFT JOIN teacher_profiles tp ON tp.user_id = u.id WHERE u.id = ?"
    )
    .get(req.user.id)) as { email: string; first_name?: string; last_name?: string } | undefined;
  const scope = await getUserScope(req.user.id);
  res.json({
    data: {
      user: {
        id: req.user.id,
        email: profile?.email,
        firstName: profile?.first_name,
        lastName: profile?.last_name
      },
      scope
    }
  });
}));

router.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  const authHeader = req.header("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token) {
    await deleteSession(token);
  }
  res.json({ data: { ok: true } });
}));

export default router;
