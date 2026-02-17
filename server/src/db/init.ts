import { initDb } from "./index";

async function main() {
  const db = await initDb();

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

  const tx = db.transaction(() => {
    const insertRole = db.prepare("INSERT OR IGNORE INTO roles (name) VALUES (?)");
    const insertPermission = db.prepare("INSERT OR IGNORE INTO permissions (name) VALUES (?)");

    const insertRolePermission = db.prepare(
      "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)"
    );

    for (const role of roles) {
      insertRole.run(role);
    }

    for (const permission of permissions) {
      insertPermission.run(permission);
    }

    const roleRows = db.prepare("SELECT id, name FROM roles").all();
    const permRows = db.prepare("SELECT id, name FROM permissions").all();

    const permByName = new Map(permRows.map((p: any) => [p.name, p.id]));
    const roleByName = new Map(roleRows.map((r: any) => [r.name, r.id]));

    const grant = (role: string, perms: string[]) => {
      const roleId = roleByName.get(role);
      if (!roleId) return;
      for (const perm of perms) {
        const permId = permByName.get(perm);
        if (!permId) continue;
        insertRolePermission.run(roleId, permId);
      }
    };

    grant("teacher", [
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

    grant("class_teacher", [
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

    grant("admin_teacher", [
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

  tx();

  console.log("Database initialized and base roles/permissions seeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
