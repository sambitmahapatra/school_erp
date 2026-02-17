import { getDb } from "../../db";

export function listLeaveTypes() {
  const db = getDb();
  return db.prepare("SELECT * FROM leave_types ORDER BY name").all();
}

export function getLeaveBalances(teacherId: number) {
  const db = getDb();
  return db
    .prepare(
      "SELECT lt.name, lb.balance FROM leave_balances lb INNER JOIN leave_types lt ON lt.id = lb.leave_type_id WHERE lb.teacher_id = ?"
    )
    .all(teacherId);
}

export function createLeaveRequest(input: {
  teacherId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  reason?: string | null;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      "INSERT INTO leave_requests (teacher_id, leave_type_id, start_date, end_date, reason, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)"
    )
    .run(input.teacherId, input.leaveTypeId, input.startDate, input.endDate, input.reason || null, now, now);
  return Number(result.lastInsertRowid);
}

export function decideLeaveRequest(input: {
  leaveRequestId: number;
  approvedBy: number;
  decision: "approved" | "rejected";
}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE leave_requests SET status = ?, updated_at = ? WHERE id = ?").run(
    input.decision,
    now,
    input.leaveRequestId
  );
  db.prepare(
    "INSERT INTO leave_approvals (leave_request_id, approved_by, decision, decided_at) VALUES (?, ?, ?, ?)"
  ).run(input.leaveRequestId, input.approvedBy, input.decision, now);
}

export function getLeaveCalendar(month: string) {
  const db = getDb();
  return db
    .prepare(
      "SELECT lr.id, lr.teacher_id, tp.first_name, tp.last_name, lr.start_date, lr.end_date, lr.status FROM leave_requests lr INNER JOIN teacher_profiles tp ON tp.id = lr.teacher_id WHERE substr(lr.start_date, 1, 7) <= ? AND substr(lr.end_date, 1, 7) >= ?"
    )
    .all(month, month);
}
