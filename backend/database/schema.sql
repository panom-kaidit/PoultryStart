
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
  starting_stage     TEXT NOT NULL DEFAULT 'day_old' CHECK (starting_stage IN ('day_old', 'pullet', 'point_of_lay')),
  starting_age_weeks INTEGER CHECK (starting_age_weeks IS NULL OR (starting_age_weeks >= 0 AND starting_age_weeks <= 100)),
  house_status       TEXT CHECK (house_status IS NULL OR house_status IN ('existing', 'not_built')),
  house_length_m     REAL CHECK (house_length_m IS NULL OR house_length_m > 0),
  house_width_m      REAL CHECK (house_width_m IS NULL OR house_width_m > 0),
  non_usable_area_m2 REAL CHECK (non_usable_area_m2 IS NULL OR non_usable_area_m2 >= 0),
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


-- Flock: a group of birds that ARRIVED together and is managed as one unit.

CREATE TABLE IF NOT EXISTS flocks (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id            INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name               TEXT,                                 
  poultry_type       TEXT    NOT NULL CHECK (poultry_type IN ('broiler', 'layer')),
  start_date         TEXT    NOT NULL,
  initial_bird_count INTEGER NOT NULL CHECK (initial_bird_count > 0), 
  status             TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  starting_stage       TEXT NOT NULL DEFAULT 'day_old' CHECK (starting_stage IN ('day_old', 'pullet', 'point_of_lay')),
  age_at_arrival_weeks INTEGER CHECK (age_at_arrival_weeks IS NULL OR (age_at_arrival_weeks >= 0 AND age_at_arrival_weeks <= 100)),
  breed_strain         TEXT,
  supplier             TEXT, 
  males_received       INTEGER CHECK (males_received IS NULL OR males_received >= 0),
  females_received     INTEGER CHECK (females_received IS NULL OR females_received >= 0),
  vaccination_notes    TEXT,  
  notes                TEXT,
  capacity_status      TEXT CHECK (capacity_status IS NULL OR capacity_status IN ('incomplete', 'house_not_built', 'above_capacity', 'within_capacity')),
  recommended_capacity INTEGER CHECK (recommended_capacity IS NULL OR recommended_capacity >= 0),
  density_mode         TEXT CHECK (density_mode IS NULL OR density_mode IN ('standard', 'conservative')),
  closed_at            TEXT,
  closure_reason       TEXT CHECK (closure_reason IS NULL OR closure_reason IN ('completed', 'ended_early')),
  closure_notes        TEXT,
  first_egg_date       TEXT CHECK (first_egg_date IS NULL OR (poultry_type = 'layer' AND first_egg_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND first_egg_date >= start_date)),
  expected_sale_date   TEXT CHECK (expected_sale_date IS NULL OR (poultry_type = 'broiler' AND expected_sale_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND expected_sale_date >= start_date)),
  created_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FlockBirdMovement 
CREATE UNIQUE INDEX IF NOT EXISTS ux_flocks_id_farm ON flocks(id, farm_id);

CREATE TABLE IF NOT EXISTS flock_bird_movements (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id              INTEGER NOT NULL,
  flock_id             INTEGER NOT NULL,
  movement_type        TEXT    NOT NULL CHECK (movement_type IN
                       ('received', 'additional_received', 'mortality', 'culled', 'sold', 'transferred_out', 'correction')),
  bird_change          INTEGER NOT NULL CHECK (bird_change <> 0),
  movement_date        TEXT    NOT NULL CHECK (movement_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'), -- effective date
  reason               TEXT,                              
  notes                TEXT,
  corrects_movement_id INTEGER,  
  recorded_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  replaces_movement_id INTEGER REFERENCES flock_bird_movements(id) ON DELETE CASCADE
                       CHECK (replaces_movement_id IS NULL OR movement_type = 'correction'),
  correction_amount    INTEGER CHECK (correction_amount IS NULL OR movement_type = 'correction'),
  birds_age_weeks      INTEGER CHECK (birds_age_weeks IS NULL OR (birds_age_weeks BETWEEN 0 AND 100 AND movement_type = 'additional_received')),
  FOREIGN KEY (flock_id, farm_id) REFERENCES flocks(id, farm_id) ON DELETE CASCADE,
  FOREIGN KEY (corrects_movement_id, flock_id) REFERENCES flock_bird_movements(id, flock_id) ON DELETE CASCADE,
  CHECK (
    (movement_type IN ('received', 'additional_received') AND bird_change > 0)
    OR (movement_type IN ('mortality', 'culled', 'sold', 'transferred_out') AND bird_change < 0)
    OR (movement_type = 'correction')
  ),

  CHECK ((movement_type = 'correction') = (corrects_movement_id IS NOT NULL)),
  CHECK (movement_type <> 'correction' OR (reason IS NOT NULL AND length(trim(reason)) > 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_movements_id_flock ON flock_bird_movements(id, flock_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_movements_one_received ON flock_bird_movements(flock_id) WHERE movement_type = 'received';
CREATE INDEX IF NOT EXISTS idx_movements_flock_date ON flock_bird_movements(flock_id, movement_date);

DROP TRIGGER IF EXISTS trg_movements_no_update;
CREATE TRIGGER trg_movements_no_update
BEFORE UPDATE ON flock_bird_movements
WHEN NOT (
  OLD.movement_type = 'received'
  AND NEW.id = OLD.id AND NEW.farm_id = OLD.farm_id AND NEW.flock_id = OLD.flock_id
  AND NEW.movement_type = OLD.movement_type AND NEW.bird_change = OLD.bird_change
  AND NEW.reason IS OLD.reason AND NEW.notes IS OLD.notes
  AND NEW.corrects_movement_id IS OLD.corrects_movement_id AND NEW.replaces_movement_id IS OLD.replaces_movement_id
  AND NEW.correction_amount IS OLD.correction_amount AND NEW.birds_age_weeks IS OLD.birds_age_weeks
  AND NEW.recorded_by IS OLD.recorded_by AND NEW.created_at = OLD.created_at
  AND (SELECT COUNT(*) FROM flock_bird_movements WHERE flock_id = OLD.flock_id) = 1
)
BEGIN
  SELECT RAISE(ABORT, 'Bird movements cannot be edited. Record a correction instead.');
END;

CREATE TRIGGER IF NOT EXISTS trg_movements_no_delete
BEFORE DELETE ON flock_bird_movements
WHEN EXISTS (SELECT 1 FROM flocks WHERE id = OLD.flock_id)
BEGIN
  SELECT RAISE(ABORT, 'Bird movements cannot be deleted. Record a correction instead.');
END;


CREATE TRIGGER IF NOT EXISTS trg_movements_not_negative
BEFORE INSERT ON flock_bird_movements
WHEN (SELECT COALESCE(SUM(bird_change), 0) FROM flock_bird_movements WHERE flock_id = NEW.flock_id) + NEW.bird_change < 0
BEGIN
  SELECT RAISE(ABORT, 'The live bird count cannot go below zero.');
END;

DROP INDEX IF EXISTS ux_movements_one_correction;
CREATE UNIQUE INDEX IF NOT EXISTS ux_movements_first_correction
  ON flock_bird_movements(corrects_movement_id)
  WHERE movement_type = 'correction' AND replaces_movement_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_movements_replaced_once
  ON flock_bird_movements(replaces_movement_id) WHERE replaces_movement_id IS NOT NULL;


DROP TRIGGER IF EXISTS trg_movements_valid_correction;
CREATE TRIGGER trg_movements_valid_correction
BEFORE INSERT ON flock_bird_movements
WHEN NEW.movement_type = 'correction'
BEGIN
  SELECT RAISE(ABORT, 'This correction is not allowed for the movement it refers to.')
   WHERE EXISTS (
     SELECT 1 FROM flock_bird_movements o
      WHERE o.id = NEW.corrects_movement_id
        AND (o.movement_type = 'correction'
             OR (o.bird_change > 0 AND o.bird_change + COALESCE(NEW.correction_amount, NEW.bird_change) < 0)
             OR (o.bird_change < 0 AND o.bird_change + COALESCE(NEW.correction_amount, NEW.bird_change) > 0)
             OR (o.movement_type = 'received' AND o.bird_change + COALESCE(NEW.correction_amount, NEW.bird_change) <= 0)));
  SELECT RAISE(ABORT, 'A replacement must replace a correction of the same movement.')
   WHERE NEW.replaces_movement_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM flock_bird_movements p
        WHERE p.id = NEW.replaces_movement_id AND p.movement_type = 'correction'
          AND p.corrects_movement_id = NEW.corrects_movement_id AND p.flock_id = NEW.flock_id);
  SELECT RAISE(ABORT, 'The bird change of a correction does not match its correction amount.')
   WHERE NEW.bird_change <> COALESCE(NEW.correction_amount, NEW.bird_change)
         - COALESCE((SELECT COALESCE(p.correction_amount, p.bird_change)
                       FROM flock_bird_movements p WHERE p.id = NEW.replaces_movement_id), 0);
END;

-- Arrival corrections 
CREATE TABLE IF NOT EXISTS flock_arrival_corrections (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  flock_id         INTEGER NOT NULL REFERENCES flocks(id) ON DELETE CASCADE,
  changes          TEXT    NOT NULL, 
  reason           TEXT    NOT NULL CHECK (length(trim(reason)) > 0),
  corrected_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_arrival_corrections_flock ON flock_arrival_corrections(flock_id);
DROP TRIGGER IF EXISTS trg_arrival_corrections_no_update;
CREATE TRIGGER trg_arrival_corrections_no_update
BEFORE UPDATE ON flock_arrival_corrections
BEGIN
  SELECT RAISE(ABORT, 'Arrival corrections cannot be edited.');
END;
-- FlockBirdMovement (end)

-- ReadinessAssessment: a farm's readiness for a new flock, based on a set of questions and a checklist of resources.

CREATE TABLE IF NOT EXISTS readiness_assessments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id         INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  poultry_type    TEXT    NOT NULL CHECK (poultry_type IN ('broiler', 'layer')),
  starting_stage  TEXT NOT NULL DEFAULT 'day_old' CHECK (starting_stage IN ('day_old', 'pullet', 'point_of_lay')),
  starting_age_weeks INTEGER CHECK (starting_age_weeks IS NULL OR (starting_age_weeks >= 0 AND starting_age_weeks <= 100)),
  density_mode    TEXT CHECK (density_mode IS NULL OR density_mode IN ('standard', 'conservative')),
  assessment_date TEXT    NOT NULL DEFAULT (date('now')),
  status          TEXT    NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started', 'in_progress', 'not_ready', 'ready')),
  completed_at    TEXT,
  created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Supporting table: the questions asked in an assessment.

CREATE TABLE IF NOT EXISTS readiness_questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    NOT NULL UNIQUE,
  area          TEXT    NOT NULL CHECK (area IN ('housing', 'equipment', 'feed', 'water', 'other')),
  question_text TEXT    NOT NULL,
  help_text     TEXT,                           
  starting_stages TEXT  NOT NULL DEFAULT 'all', 
  verification_note TEXT,                      
  poultry_type  TEXT    NOT NULL DEFAULT 'all' CHECK (poultry_type IN ('all', 'broiler', 'layer')),
  is_required   INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0, 1)),
  -- When this must be in place: before the chicks arrive, or a later stage.
  needed_by     TEXT    NOT NULL DEFAULT 'chick_arrival' CHECK (needed_by IN ('chick_arrival', 'before_transfer', 'before_first_egg', 'before_sale')),
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
  needed_by     TEXT    NOT NULL DEFAULT 'chick_arrival' CHECK (needed_by IN ('chick_arrival', 'before_transfer', 'before_first_egg', 'before_sale')),
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
  -- Daily Tasks module
  flock_id         INTEGER REFERENCES flocks(id) ON DELETE CASCADE,   
  source           TEXT    NOT NULL DEFAULT 'custom' CHECK (source IN ('custom', 'generated')),
  template_code    TEXT,                                             
  frequency        TEXT    NOT NULL DEFAULT 'once' CHECK (frequency IN ('daily', 'interval', 'weekly', 'once')),
  time_slot        TEXT    NOT NULL DEFAULT 'any' CHECK (time_slot IN ('morning', 'midday', 'evening', 'any')),
  occurrence       INTEGER NOT NULL DEFAULT 1 CHECK (occurrence >= 1), 
  generation_key   TEXT    CHECK ((source = 'generated') = (generation_key IS NOT NULL)),
  completion_notes TEXT,
  problem_reported INTEGER NOT NULL DEFAULT 0 CHECK (problem_reported IN (0, 1)),
  cancel_reason    TEXT,
  cancelled_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at     TEXT    CHECK (cancelled_at IS NULL OR (status = 'pending' AND cancel_reason IS NOT NULL AND length(trim(cancel_reason)) > 0)),
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DailyTaskSupport (begin): tables, indexes and rules added with the Daily

CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_generation ON daily_tasks(farm_id, generation_key) WHERE generation_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_farm_due ON daily_tasks(farm_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_flock    ON daily_tasks(flock_id);

-- TaskEvent: the audit history of a task
CREATE TABLE IF NOT EXISTS task_events (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id                   INTEGER NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  event_type                TEXT    NOT NULL CHECK (event_type IN ('reopened', 'review_note')),
  note                      TEXT    NOT NULL CHECK (length(trim(note)) > 0),  -- the reason or the note
  previous_completed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  previous_completed_at     TEXT,
  previous_completion_notes TEXT,
  previous_problem_reported INTEGER CHECK (previous_problem_reported IS NULL OR previous_problem_reported IN (0, 1)),
  user_id                   INTEGER REFERENCES users(id) ON DELETE SET NULL,   -- who did it
  created_at                TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,         -- when (UTC)
  CHECK (event_type = 'reopened' OR (previous_completed_by IS NULL AND previous_completed_at IS NULL
         AND previous_completion_notes IS NULL AND previous_problem_reported IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);

-- Triggers hold no data, so they are dropped and re-created on every start.

-- A task's flock must belong to the task's farm.
DROP TRIGGER IF EXISTS trg_tasks_flock_same_farm_insert;
CREATE TRIGGER trg_tasks_flock_same_farm_insert
BEFORE INSERT ON daily_tasks
WHEN NEW.flock_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM flocks WHERE id = NEW.flock_id AND farm_id = NEW.farm_id)
BEGIN
  SELECT RAISE(ABORT, 'The task''s flock must belong to the same farm.');
END;
DROP TRIGGER IF EXISTS trg_tasks_flock_same_farm_update;
CREATE TRIGGER trg_tasks_flock_same_farm_update
BEFORE UPDATE OF flock_id, farm_id ON daily_tasks
WHEN NEW.flock_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM flocks WHERE id = NEW.flock_id AND farm_id = NEW.farm_id)
BEGIN
  SELECT RAISE(ABORT, 'The task''s flock must belong to the same farm.');
END;


DROP TRIGGER IF EXISTS trg_tasks_keep_history;
CREATE TRIGGER trg_tasks_keep_history
BEFORE DELETE ON daily_tasks
WHEN EXISTS (SELECT 1 FROM farms WHERE id = OLD.farm_id)
 AND (OLD.status = 'completed' OR EXISTS (SELECT 1 FROM task_events WHERE task_id = OLD.id))
BEGIN
  SELECT RAISE(ABORT, 'Tasks with history (completed, or with audit events) cannot be deleted.');
END;

-- Task events are never edited, and never deleted on their own.
DROP TRIGGER IF EXISTS trg_task_events_no_update;
CREATE TRIGGER trg_task_events_no_update
BEFORE UPDATE ON task_events
BEGIN
  SELECT RAISE(ABORT, 'Task history cannot be edited.');
END;
DROP TRIGGER IF EXISTS trg_task_events_no_delete;
CREATE TRIGGER trg_task_events_no_delete
BEFORE DELETE ON task_events
WHEN EXISTS (SELECT 1 FROM daily_tasks WHERE id = OLD.task_id)
BEGIN
  SELECT RAISE(ABORT, 'Task history cannot be deleted.');
END;

-- FlockMilestoneChange: every setting or change of a flock's first-egg date

CREATE TABLE IF NOT EXISTS flock_milestone_changes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  flock_id    INTEGER NOT NULL REFERENCES flocks(id) ON DELETE CASCADE,
  milestone   TEXT    NOT NULL CHECK (milestone IN ('first_egg_date', 'expected_sale_date')),
  from_value  TEXT,                                -- NULL when first set
  to_value    TEXT    NOT NULL CHECK (to_value GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  reason      TEXT,
  changed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (from_value IS NULL OR (reason IS NOT NULL AND length(trim(reason)) > 0))
);
CREATE INDEX IF NOT EXISTS idx_milestone_changes_flock ON flock_milestone_changes(flock_id, milestone);
DROP TRIGGER IF EXISTS trg_milestone_changes_no_update;
CREATE TRIGGER trg_milestone_changes_no_update
BEFORE UPDATE ON flock_milestone_changes
BEGIN
  SELECT RAISE(ABORT, 'Milestone history cannot be edited.');
END;
-- DailyTaskSupport (end)


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
