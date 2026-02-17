import { initDb } from "./index";
import { hashPassword } from "../modules/auth/auth.service";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const firstName = process.env.ADMIN_FIRST_NAME || "Admin";
  const lastName = process.env.ADMIN_LAST_NAME || "Teacher";

  if (!email || !password) {
    console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD. Example: ADMIN_EMAIL=admin@school.local ADMIN_PASSWORD=ChangeMe123");
    process.exit(1);
  }

  const db = await initDb();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);

  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users (email, password_hash, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)"
  );
  insertUser.run(email, passwordHash, now, now);

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;
  if (!user) {
    console.error("Failed to create admin user.");
    process.exit(1);
  }

  const insertProfile = db.prepare(
    "INSERT OR IGNORE INTO teacher_profiles (user_id, first_name, last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  );
  insertProfile.run(user.id, firstName, lastName, now, now);

  const role = db.prepare("SELECT id FROM roles WHERE name = ?").get("admin_teacher") as { id: number } | undefined;
  if (role) {
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)").run(user.id, role.id);
  }

  console.log(`Admin user ready: ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
