import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/async-handler";
import { clearClassData, importStudentsFromCsv } from "../modules/data/data.service";

const router = Router();

const importSchema = z.object({
  csv: z.string().min(1),
  classId: z.number(),
  mode: z.enum(["append", "replace"]).default("append")
});

router.post(
  "/import/students",
  requireAuth,
  requirePermission("dashboard.read"),
  validateBody(importSchema),
  asyncHandler(async (req, res) => {
    const { csv, classId, mode } = req.body as { csv: string; classId: number; mode: "append" | "replace" };
    const result = await importStudentsFromCsv(req.user.id, classId, csv, mode);
    if (result.errors.length && result.inserted === 0 && result.updated === 0) {
      return res.status(400).json({ error: { code: "invalid_csv", message: "No valid rows found", detail: result } });
    }
    res.json({ data: result });
  })
);

const clearSchema = z.object({
  scope: z.enum(["attendance", "marks", "students"])
});

router.post(
  "/classes/:classId/clear",
  requireAuth,
  requirePermission("admin.read"),
  validateBody(clearSchema),
  asyncHandler(async (req, res) => {
    const classId = Number(req.params.classId);
    if (!classId) {
      return res.status(400).json({ error: { code: "invalid_class", message: "Invalid class id" } });
    }
    const { scope } = req.body as { scope: "attendance" | "marks" | "students" };
    const result = await clearClassData(req.user.id, classId, scope);
    res.json({ data: result });
  })
);

export default router;
