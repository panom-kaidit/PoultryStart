
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Farms: each farm has one owner (the user who created it) and may have other members.
CREATE TABLE IF NOT EXISTS farms (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id         INTEGER NOT NULL REFERENCES users(id), 
  name             TEXT    NOT NULL,
  location         TEXT    NOT NULL,
  poultry_type     TEXT    NOT NULL CHECK (poultry_type IN ('broiler', 'layer')),
  number_of_birds  INTEGER NOT NULL CHECK (number_of_birds >= 0),   -- planned number of birds
  experience_level TEXT    NOT NULL CHECK (experience_level IN ('beginner', 'some_experience', 'experienced')),
  farm_size        TEXT,                                   -- free text, e.g. "Half an acre"
  management_mode  TEXT    NOT NULL DEFAULT 'independent'
                   CHECK (management_mode IN ('independent', 'with_team')),
  currency         TEXT    NOT NULL DEFAULT 'UGX',         -- can be changed per farm
  created_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- FarmMembership: which users can access which farm, and in what role.
-- The owner also gets a row here (role = 'owner') when the farm is created,

CREATE TABLE IF NOT EXISTS farm_memberships (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id    INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT    NOT NULL CHECK (role IN ('owner', 'manager', 'worker')),
  added_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (farm_id, user_id)                   -- a user joins a farm only once
);


-- Flock: a group of birds managed together,
-- Current bird count = initial_bird_count - SUM(mortality birds_lost)

CREATE TABLE IF NOT EXISTS flocks (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id            INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name               TEXT,                                  -- optional label, e.g. "Batch 1"
  poultry_type       TEXT    NOT NULL CHECK (poultry_type IN ('broiler', 'layer')),
  start_date         TEXT    NOT NULL,
  initial_bird_count INTEGER NOT NULL CHECK (initial_bird_count > 0),
  status             TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ReadinessAssessment: a farm's readiness for a new flock, based on a set of questions and a checklist of resources.

CREATE TABLE IF NOT EXISTS readiness_assessments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id         INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  assessment_date TEXT    NOT NULL DEFAULT (date('now')),
  status          TEXT    NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started', 'in_progress', 'not_ready', 'ready')),
  completed_at    TEXT,
  created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Supporting table: the questions asked in an assessment (seeded data)
CREATE TABLE IF NOT EXISTS readiness_questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  area          TEXT    NOT NULL CHECK (area IN ('housing', 'equipment', 'feed', 'water')),
  question_text TEXT    NOT NULL,
  poultry_type  TEXT    NOT NULL DEFAULT 'all' CHECK (poultry_type IN ('all', 'broiler', 'layer')),
  is_required   INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0, 1)),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Supporting table: one answer per question per assessment
CREATE TABLE IF NOT EXISTS readiness_responses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL REFERENCES readiness_assessments(id) ON DELETE CASCADE,
  question_id   INTEGER NOT NULL REFERENCES readiness_questions(id) ON DELETE CASCADE,
  answer        TEXT    NOT NULL CHECK (answer IN ('yes', 'no', 'partly')),
  notes         TEXT,
  answered_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (assessment_id, question_id)
);

-- ResourceChecklistItem 

CREATE TABLE IF NOT EXISTS resource_checklist_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id       INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  assessment_id INTEGER NOT NULL REFERENCES readiness_assessments(id) ON DELETE CASCADE,
  item_name     TEXT    NOT NULL,
  category      TEXT    NOT NULL CHECK (category IN ('housing', 'equipment', 'feed', 'water', 'other')),
  is_required   INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0, 1)),
  is_available  INTEGER NOT NULL DEFAULT 0 CHECK (is_available IN (0, 1)),
  is_custom     INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1)),
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DailyTask: a task assigned to a farm member, with a due date and status.

CREATE TABLE IF NOT EXISTS daily_tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id      INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  description  TEXT,
  due_date     TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  assigned_to  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_at TEXT,
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FarmActivityRecord: a record of feeding, watering, health checks, or mortality events for a flock.

CREATE TABLE IF NOT EXISTS farm_activity_records (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id       INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  flock_id      INTEGER NOT NULL REFERENCES flocks(id) ON DELETE CASCADE,
  activity_type TEXT    NOT NULL CHECK (activity_type IN ('feeding', 'water', 'health', 'mortality')),
  activity_date TEXT    NOT NULL,
  quantity      REAL    CHECK (quantity IS NULL OR quantity >= 0),   -- feed / water amount
  unit          TEXT,                                                -- e.g. kg, litres
  birds_lost    INTEGER,                                             -- mortality only
  notes         TEXT,
  recorded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- birds_lost is required for mortality records and not allowed otherwise
  CHECK (
    (activity_type = 'mortality' AND birds_lost IS NOT NULL AND birds_lost > 0)
    OR (activity_type <> 'mortality' AND birds_lost IS NULL)
  )
);


-- ExpenseRecord: a record of an expense incurred for the farm, with amount in the farm's currency.
-- in the farm's currency (farms.currency).

CREATE TABLE IF NOT EXISTS expense_records (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id      INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  category     TEXT    NOT NULL CHECK (category IN
               ('feed', 'chicks', 'medication', 'equipment', 'labour', 'transport', 'other')),
  amount       INTEGER NOT NULL CHECK (amount > 0),
  expense_date TEXT    NOT NULL,
  notes        TEXT,
  recorded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PoultryGuidance: guidance content for poultry farmers, organized by topic and poultry type.
-- Guidance is organized by topic and poultry type

CREATE TABLE IF NOT EXISTS poultry_guidance (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  topic        TEXT    NOT NULL CHECK (topic IN (
               'farm_preparation', 'housing', 'feeding', 'water', 'flock_management',
               'hygiene', 'health_monitoring', 'daily_activities')),
  poultry_type TEXT    NOT NULL DEFAULT 'all' CHECK (poultry_type IN ('all', 'broiler', 'layer')),
  content      TEXT    NOT NULL,
  source       TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes: speed up the most common lookups (records for one farm)

CREATE INDEX IF NOT EXISTS idx_memberships_user   ON farm_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_flocks_farm        ON flocks(farm_id);
CREATE INDEX IF NOT EXISTS idx_assessments_farm   ON readiness_assessments(farm_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assess   ON resource_checklist_items(assessment_id);
CREATE INDEX IF NOT EXISTS idx_tasks_farm         ON daily_tasks(farm_id);
CREATE INDEX IF NOT EXISTS idx_activities_farm    ON farm_activity_records(farm_id);
CREATE INDEX IF NOT EXISTS idx_activities_flock   ON farm_activity_records(flock_id);
CREATE INDEX IF NOT EXISTS idx_expenses_farm      ON expense_records(farm_id);
