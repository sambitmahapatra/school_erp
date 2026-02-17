import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { validateBody } from "../middleware/validate";
import { addNote, getStudentTimeline, updateNote } from "../modules/progress/progress.service";

const router = Router();

router.get("/student/:studentId", requireAuth, requirePermission("progress.read"), (req, res) => {
  const studentId = Number(req.params.studentId);
  const data = getStudentTimeline(studentId);
  res.json({ data });
});

const noteSchema = z.object({
  studentId: z.number(),
  note: z.string().min(1),
  isFlagged: z.boolean().optional()
});

router.post(
  "/notes",
  requireAuth,
  requirePermission("progress.write"),
  validateBody(noteSchema),
  (req, res) => {
    if (!req.user.teacherId) {
      return res.status(400).json({ error: { code: "invalid_state", message: "Teacher profile missing" } });
    }
    const id = addNote({
      teacherId: req.user.teacherId,
      studentId: req.body.studentId,
      note: req.body.note,
      isFlagged: req.body.isFlagged
    });
    res.json({ data: { id } });
  }
);

const updateSchema = z.object({
  note: z.string().min(1),
  isFlagged: z.boolean().optional()
});

router.patch(
  "/notes/:id",
  requireAuth,
  requirePermission("progress.write"),
  validateBody(updateSchema),
  (req, res) => {
    const noteId = Number(req.params.id);
    updateNote(noteId, { note: req.body.note, isFlagged: req.body.isFlagged });
    res.json({ data: { ok: true } });
  }
);

export default router;
