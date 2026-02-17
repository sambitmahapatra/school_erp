import { getDb } from "../db";

export async function logActivity(
  userId: number,
  action: string,
  entityType: string,
  entityId: number,
  detail?: string
) {
  const db = getDb();
  await db
    .prepare(
      "INSERT INTO activity_log (user_id, action, entity_type, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(userId, action, entityType, entityId, detail || null, new Date().toISOString());
}
