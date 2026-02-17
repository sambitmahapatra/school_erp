PRAGMA foreign_keys = ON;

-- Users and RBAC
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

CREATE TABLE IF NOT EXISTS teacher_profiles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  employee_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Academic structure
CREATE TABLE IF NOT EXISTS academic_years (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY,
  academic_year_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY,
  grade INTEGER NOT NULL,
  section TEXT NOT NULL,
  name TEXT NOT NULL,
  academic_year_id INTEGER NOT NULL,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  UNIQUE (grade, name, section, academic_year_id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  grade_from INTEGER NOT NULL,
  grade_to INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS class_subjects (
  id INTEGER PRIMARY KEY,
  class_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  is_optional INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (class_id, subject_id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

CREATE TABLE IF NOT EXISTS student_subjects (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  class_subject_id INTEGER NOT NULL,
  is_enrolled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (student_id, class_subject_id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id)
);

CREATE TABLE IF NOT EXISTS class_subject_exam_rules (
  id INTEGER PRIMARY KEY,
  class_subject_id INTEGER NOT NULL,
  exam_type TEXT NOT NULL,
  max_marks INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (class_subject_id, exam_type),
  FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  admission_no TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  class_id INTEGER NOT NULL,
  roll_no INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  subject_id INTEGER,
  assignment_role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  class_id INTEGER NOT NULL,
  subject_id INTEGER,
  teacher_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(id)
);

CREATE TABLE IF NOT EXISTS attendance_entries (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  updated_by INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES attendance_sessions(id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (updated_by) REFERENCES users(id),
  UNIQUE (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS attendance_audit (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT,
  changed_by INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES attendance_entries(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- Exams and marks
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY,
  academic_year_id INTEGER NOT NULL,
  term_id INTEGER,
  name TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  FOREIGN KEY (term_id) REFERENCES terms(id)
);

CREATE TABLE IF NOT EXISTS exam_components (
  id INTEGER PRIMARY KEY,
  exam_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  max_marks INTEGER NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  FOREIGN KEY (exam_id) REFERENCES exams(id)
);

CREATE TABLE IF NOT EXISTS marks_entries (
  id INTEGER PRIMARY KEY,
  exam_id INTEGER NOT NULL,
  component_id INTEGER,
  class_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  teacher_id INTEGER NOT NULL,
  max_marks INTEGER NOT NULL,
  marks_obtained REAL,
  is_absent INTEGER NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (component_id) REFERENCES exam_components(id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(id),
  UNIQUE (exam_id, component_id, class_id, subject_id, student_id)
);

CREATE TABLE IF NOT EXISTS grade_scale (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  min_percentage REAL NOT NULL,
  max_percentage REAL NOT NULL
);

-- Teacher notes and flags
CREATE TABLE IF NOT EXISTS teacher_notes (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  is_flagged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Leave management
CREATE TABLE IF NOT EXISTS leave_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  default_balance REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL,
  leave_type_id INTEGER NOT NULL,
  balance REAL NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(id),
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
  UNIQUE (teacher_id, leave_type_id)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL,
  leave_type_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(id),
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
);

CREATE TABLE IF NOT EXISTS leave_approvals (
  id INTEGER PRIMARY KEY,
  leave_request_id INTEGER NOT NULL,
  approved_by INTEGER NOT NULL,
  decision TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Alerts and audit
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY,
  alert_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  scope_id INTEGER,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date_class ON attendance_sessions(date, class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_entries_student ON attendance_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_entries_student ON marks_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_entries_class_subject ON marks_entries(class_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_student ON student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_rules_class_subject ON class_subject_exam_rules(class_subject_id);
