import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/async-handler";
import {
  createLeaveRequest,
  decideLeaveRequest,
  getLeaveBalances,
  getLeaveCalendar,
  listLeaveTypes
} from "../modules/leaves/leave.service";

const router = Router();

router.get("/types", requireAuth, requirePermission("leave.read"), asyncHandler(async (_req, res) => {
  res.json({ data: await listLeaveTypes() });
}));

router.get("/balances", requireAuth, requirePermission("leave.read"), asyncHandler(async (req, res) => {
  if (!req.user.teacherId) {
    return res.status(400).json({ error: { code: "invalid_state", message: "Teacher profile missing" } });
  }
  res.json({ data: await getLeaveBalances(req.user.teacherId) });
}));

const requestSchema = z.object({
  leaveTypeId: z.number(),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
  reason: z.string().optional()
});

router.post(
  "/requests",
  requireAuth,
  requirePermission("leave.write"),
  validateBody(requestSchema),
  asyncHandler(async (req, res) => {
    if (!req.user.teacherId) {
      return res.status(400).json({ error: { code: "invalid_state", message: "Teacher profile missing" } });
    }
    const id = await createLeaveRequest({
      teacherId: req.user.teacherId,
      leaveTypeId: req.body.leaveTypeId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      reason: req.body.reason
    });
    res.json({ data: { id } });
  })
);

const decideSchema = z.object({ decision: z.enum(["approved", "rejected"]) });

router.patch(
  "/requests/:id",
  requireAuth,
  requirePermission("leave.write"),
  validateBody(decideSchema),
  asyncHandler(async (req, res) => {
    const leaveRequestId = Number(req.params.id);
    await decideLeaveRequest({ leaveRequestId, approvedBy: req.user.id, decision: req.body.decision });
    res.json({ data: { ok: true } });
  })
);

router.get("/calendar", requireAuth, requirePermission("leave.read"), asyncHandler(async (req, res) => {
  const month = String(req.query.month);
  res.json({ data: await getLeaveCalendar(month) });
}));

export default router;
