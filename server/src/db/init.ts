import fs from "fs";
import path from "path";
import { getDb, initDb } from "./index";

async function main() {
  await initDb();
  const db = getDb();

  const schemaCandidates = [
    path.resolve(process.cwd(), "src", "db", "schema.sql"),
    path.resolve(process.cwd(), "dist", "db", "schema.sql")
  ];
  const schemaPath = schemaCandidates.find((candidate) => fs.existsSync(candidate));
  if (!schemaPath) {
    throw new Error("schema.sql not found in src/db or dist/db");
  }
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  await db.exec(schemaSql);

  const roles = ["teacher", "class_teacher", "admin_teacher"];
  const permissions = [
    "attendance.read",
    "attendance.write",
    "marks.read",
    "marks.write",
    "progress.read",
    "progress.write",
    "leave.read",
    "leave.write",
    "dashboard.read",
    "admin.read"
  ];

  await db.transaction(async (tx) => {
    const insertRole = tx.prepare("INSERT OR IGNORE INTO roles (name) VALUES (?)");
    const insertPermission = tx.prepare("INSERT OR IGNORE INTO permissions (name) VALUES (?)");
    const insertRolePermission = tx.prepare(
      "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)"
    );

    for (const role of roles) {
      await insertRole.run(role);
    }

    for (const permission of permissions) {
      await insertPermission.run(permission);
    }

    const roleRows = await tx.prepare("SELECT id, name FROM roles").all();
    const permRows = await tx.prepare("SELECT id, name FROM permissions").all();

    const permByName = new Map(permRows.map((p: any) => [p.name, p.id]));
    const roleByName = new Map(roleRows.map((r: any) => [r.name, r.id]));

    const grant = async (role: string, perms: string[]) => {
      const roleId = roleByName.get(role);
      if (!roleId) return;
      for (const perm of perms) {
        const permId = permByName.get(perm);
        if (!permId) continue;
        await insertRolePermission.run(roleId, permId);
      }
    };

    await grant("teacher", [
      "attendance.read",
      "attendance.write",
      "marks.read",
      "marks.write",
      "progress.read",
      "progress.write",
      "leave.read",
      "leave.write",
      "dashboard.read"
    ]);

    await grant("class_teacher", [
      "attendance.read",
      "attendance.write",
      "marks.read",
      "marks.write",
      "progress.read",
      "progress.write",
      "leave.read",
      "leave.write",
      "dashboard.read"
    ]);

    await grant("admin_teacher", [
      "attendance.read",
      "attendance.write",
      "marks.read",
      "marks.write",
      "progress.read",
      "progress.write",
      "leave.read",
      "leave.write",
      "dashboard.read",
      "admin.read"
    ]);
  });

  console.log("Database initialized and base roles/permissions seeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
