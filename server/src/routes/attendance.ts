import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/async-handler";
import {
  bulkUpsertEntries,
  createSession,
  getClassAttendanceSummary,
  getStudentAttendanceHistory,
  listSessions,
  updateEntry,
  updateSessionStatus
} from "../modules/attendance/attendance.service";

const router = Router();

router.get("/sessions", requireAuth, requirePermission("attendance.read"), asyncHandler(async (req, res) => {
  const date = req.query.date as string | undefined;
  const classId = req.query.classId ? Number(req.query.classId) : undefined;
  const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
  const sessions = await listSessions({ date, classId, subjectId });
  res.json({ data: sessions });
}));

const createSessionSchema = z.object({
  date: z.string().min(10),
  classId: z.number(),
  subjectId: z.number().nullable().optional()
});

router.post(
  "/sessions",
  requireAuth,
  requirePermission("attendance.write"),
  validateBody(createSessionSchema),
  asyncHandler(async (req, res) => {
    const { date, classId, subjectId } = req.body as { date: string; classId: number; subjectId?: number };
    if (!req.user.teacherId) {
      return res.status(400).json({ error: { code: "invalid_state", message: "Teacher profile missing" } });
    }
    const id = await createSession({
      date,
      classId,
      subjectId: subjectId || null,
      teacherId: req.user.teacherId,
      userId: req.user.id
    });
    res.json({ data: { id } });
  })
);

const updateSessionSchema = z.object({ status: z.enum(["draft", "submitted"]) });

router.patch(
  "/sessions/:id",
  requireAuth,
  requirePermission("attendance.write"),
  validateBody(updateSessionSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await updateSessionStatus(id, req.body.status);
    res.json({ data: { id, status: req.body.status } });
  })
);

const bulkSchema = z.object({
  sessionId: z.number(),
  entries: z.array(
    z.object({
      studentId: z.number(),
      status: z.enum(["present", "absent", "late", "excused"]),
      reason: z.string().optional()
    })
  )
});

router.post(
  "/entries/bulk",
  requireAuth,
  requirePermission("attendance.write"),
  validateBody(bulkSchema),
  asyncHandler(async (req, res) => {
    const { sessionId, entries } = req.body as { sessionId: number; entries: any[] };
    await bulkUpsertEntries({ sessionId, entries, updatedBy: req.user.id });
    res.json({ data: { ok: true } });
  })
);

const updateEntrySchema = z.object({
  status: z.enum(["present", "absent", "late", "excused"]),
  reason: z.string().optional()
});

router.patch(
  "/entries/:id",
  requireAuth,
  requirePermission("attendance.write"),
  validateBody(updateEntrySchema),
  asyncHandler(async (req, res) => {
    const entryId = Number(req.params.id);
    await updateEntry(entryId, { status: req.body.status, reason: req.body.reason, updatedBy: req.user.id });
    res.json({ data: { ok: true } });
  })
);

router.get("/analytics/class", requireAuth, requirePermission("attendance.read"), asyncHandler(async (req, res) => {
  const classId = Number(req.query.classId);
  const month = String(req.query.month);
  const data = await getClassAttendanceSummary(classId, month);
  res.json({ data });
}));

router.get("/analytics/student/:studentId", requireAuth, requirePermission("attendance.read"), asyncHandler(async (req, res) => {
  const studentId = Number(req.params.studentId);
  const data = await getStudentAttendanceHistory(studentId);
  res.json({ data });
}));

export default router;
