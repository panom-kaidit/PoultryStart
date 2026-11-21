
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

-- FlockBirdMovement (begin)
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

-- ProductionRecords (begin)
CREATE TABLE IF NOT EXISTS weight_records (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id          INTEGER NOT NULL,
  flock_id         INTEGER NOT NULL,
  record_date      TEXT    NOT NULL CHECK (record_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  method           TEXT    NOT NULL CHECK (method IN ('individual', 'aggregate')),
  sample_size      INTEGER NOT NULL CHECK (sample_size > 0),
  average_weight_g REAL    NOT NULL CHECK (average_weight_g > 0),
  min_weight_g     REAL    CHECK (min_weight_g IS NULL OR min_weight_g > 0),
  max_weight_g     REAL    CHECK (max_weight_g IS NULL OR max_weight_g > 0),
  sample_weights_g TEXT    CHECK (sample_weights_g IS NULL OR json_valid(sample_weights_g)),
  entered_unit           TEXT CHECK (entered_unit IS NULL OR entered_unit IN ('g', 'kg')),
  entered_weights        TEXT CHECK (entered_weights IS NULL OR json_valid(entered_weights)),
  entered_average_weight REAL CHECK (entered_average_weight IS NULL OR entered_average_weight > 0),
  notes            TEXT,
  version          INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flock_id, farm_id) REFERENCES flocks(id, farm_id) ON DELETE CASCADE,
  -- Individual weights only with the individual method, and then min and max are known.
  CHECK ((method = 'individual') = (sample_weights_g IS NOT NULL)),
  CHECK (method = 'aggregate' OR (min_weight_g IS NOT NULL AND max_weight_g IS NOT NULL)),
  CHECK (min_weight_g IS NULL OR max_weight_g IS NULL OR min_weight_g <= max_weight_g)
);
CREATE INDEX IF NOT EXISTS idx_weight_records_flock_date ON weight_records(flock_id, record_date);
CREATE INDEX IF NOT EXISTS idx_weight_records_farm_date  ON weight_records(farm_id, record_date);

-- Egg collections:
CREATE TABLE IF NOT EXISTS egg_collection_records (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id           INTEGER NOT NULL,
  flock_id          INTEGER NOT NULL,
  record_date       TEXT    NOT NULL CHECK (record_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  collection_period TEXT    NOT NULL CHECK (collection_period IN ('morning', 'midday', 'evening', 'extra')),
  good_eggs         INTEGER NOT NULL DEFAULT 0 CHECK (good_eggs >= 0),
  second_grade_eggs INTEGER NOT NULL DEFAULT 0 CHECK (second_grade_eggs >= 0),
  floor_eggs        INTEGER NOT NULL DEFAULT 0 CHECK (floor_eggs >= 0),
  notes             TEXT,
  version           INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flock_id, farm_id) REFERENCES flocks(id, farm_id) ON DELETE CASCADE
);
-- One record per collection period per day (no duplicate submissions).
CREATE UNIQUE INDEX IF NOT EXISTS ux_egg_records_period ON egg_collection_records(flock_id, record_date, collection_period);
CREATE INDEX IF NOT EXISTS idx_egg_records_farm_date ON egg_collection_records(farm_id, record_date);

-- Feed consumption:
CREATE TABLE IF NOT EXISTS feed_consumption_records (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id            INTEGER NOT NULL,
  flock_id           INTEGER NOT NULL,
  record_date        TEXT    NOT NULL CHECK (record_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  feed_stage         TEXT    NOT NULL DEFAULT 'unknown'
                     CHECK (feed_stage IN ('starter', 'grower', 'finisher', 'pre_lay', 'layer', 'other', 'unknown')),
  quantity_kg        REAL    NOT NULL CHECK (quantity_kg > 0),
  entered_quantity   REAL    NOT NULL CHECK (entered_quantity > 0),
  entered_unit       TEXT    NOT NULL CHECK (entered_unit IN ('kg', 'g')),
  measurement_method TEXT    NOT NULL CHECK (measurement_method IN ('measured', 'estimated')),
  notes              TEXT,
  version            INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flock_id, farm_id) REFERENCES flocks(id, farm_id) ON DELETE CASCADE
);
-- One record per flock, day and feed stage (no duplicate submissions).
CREATE UNIQUE INDEX IF NOT EXISTS ux_feed_records_day_stage ON feed_consumption_records(flock_id, record_date, feed_stage);
CREATE INDEX IF NOT EXISTS idx_feed_records_farm_date ON feed_consumption_records(farm_id, record_date);

-- Drinking-water consumption:
CREATE TABLE IF NOT EXISTS water_consumption_records (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id            INTEGER NOT NULL,
  flock_id           INTEGER NOT NULL,
  record_date        TEXT    NOT NULL CHECK (record_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  quantity_litres    REAL    NOT NULL CHECK (quantity_litres > 0),
  entered_quantity   REAL    NOT NULL CHECK (entered_quantity > 0),
  entered_unit       TEXT    NOT NULL CHECK (entered_unit IN ('L', 'ml')),
  measurement_method TEXT    NOT NULL CHECK (measurement_method IN ('measured', 'estimated')),
  notes              TEXT,
  version            INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flock_id, farm_id) REFERENCES flocks(id, farm_id) ON DELETE CASCADE
);
-- One record per flock and day.
CREATE UNIQUE INDEX IF NOT EXISTS ux_water_records_day ON water_consumption_records(flock_id, record_date);
CREATE INDEX IF NOT EXISTS idx_water_records_farm_date ON water_consumption_records(farm_id, record_date);


CREATE TABLE IF NOT EXISTS production_record_corrections (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id      INTEGER NOT NULL,
  flock_id     INTEGER NOT NULL,
  record_type  TEXT    NOT NULL CHECK (record_type IN ('weight', 'eggs', 'feed', 'water')),
  record_id    INTEGER NOT NULL,
  version_from INTEGER NOT NULL CHECK (version_from >= 1),
  version_to   INTEGER NOT NULL CHECK (version_to = version_from + 1),
  changes      TEXT    NOT NULL CHECK (json_valid(changes)),   -- { field: { from, to } }
  reason       TEXT    NOT NULL CHECK (length(trim(reason)) > 0),
  corrected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flock_id, farm_id) REFERENCES flocks(id, farm_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_record_corrections_version ON production_record_corrections(record_type, record_id, version_to);

-- Triggers hold no data, so they are dropped and re-created on every start.

DROP TRIGGER IF EXISTS trg_weight_records_corrections_only;
CREATE TRIGGER trg_weight_records_corrections_only BEFORE UPDATE ON weight_records
WHEN NEW.version <> OLD.version + 1 OR NEW.farm_id <> OLD.farm_id OR NEW.flock_id <> OLD.flock_id OR NEW.created_at <> OLD.created_at
  OR NOT EXISTS (SELECT 1 FROM production_record_corrections c WHERE c.record_type = 'weight' AND c.record_id = OLD.id AND c.version_to = NEW.version)
BEGIN SELECT RAISE(ABORT, 'Production records can only be changed through a correction with a reason.'); END;
DROP TRIGGER IF EXISTS trg_weight_records_no_delete;
CREATE TRIGGER trg_weight_records_no_delete BEFORE DELETE ON weight_records
WHEN EXISTS (SELECT 1 FROM farms WHERE id = OLD.farm_id)
BEGIN SELECT RAISE(ABORT, 'Production records cannot be deleted. Record a correction instead.'); END;

DROP TRIGGER IF EXISTS trg_egg_records_corrections_only;
CREATE TRIGGER trg_egg_records_corrections_only BEFORE UPDATE ON egg_collection_records
WHEN NEW.version <> OLD.version + 1 OR NEW.farm_id <> OLD.farm_id OR NEW.flock_id <> OLD.flock_id OR NEW.created_at <> OLD.created_at
  OR NOT EXISTS (SELECT 1 FROM production_record_corrections c WHERE c.record_type = 'eggs' AND c.record_id = OLD.id AND c.version_to = NEW.version)
BEGIN SELECT RAISE(ABORT, 'Production records can only be changed through a correction with a reason.'); END;
DROP TRIGGER IF EXISTS trg_egg_records_no_delete;
CREATE TRIGGER trg_egg_records_no_delete BEFORE DELETE ON egg_collection_records
WHEN EXISTS (SELECT 1 FROM farms WHERE id = OLD.farm_id)
BEGIN SELECT RAISE(ABORT, 'Production records cannot be deleted. Record a correction instead.'); END;

-- Feed consumption: a day cannot have both an unknown-stage feed record and named-stage feed records.
DROP TRIGGER IF EXISTS trg_feed_records_stage_exclusive_insert;
CREATE TRIGGER trg_feed_records_stage_exclusive_insert BEFORE INSERT ON feed_consumption_records
WHEN EXISTS (SELECT 1 FROM feed_consumption_records o WHERE o.flock_id = NEW.flock_id AND o.record_date = NEW.record_date
             AND (o.feed_stage = 'unknown') <> (NEW.feed_stage = 'unknown'))
BEGIN SELECT RAISE(ABORT, 'A day cannot have both an unknown-stage feed record and named-stage feed records.'); END;
DROP TRIGGER IF EXISTS trg_feed_records_stage_exclusive_update;
CREATE TRIGGER trg_feed_records_stage_exclusive_update BEFORE UPDATE OF feed_stage, record_date ON feed_consumption_records
WHEN EXISTS (SELECT 1 FROM feed_consumption_records o WHERE o.flock_id = NEW.flock_id AND o.record_date = NEW.record_date
             AND o.id <> NEW.id AND (o.feed_stage = 'unknown') <> (NEW.feed_stage = 'unknown'))
BEGIN SELECT RAISE(ABORT, 'A day cannot have both an unknown-stage feed record and named-stage feed records.'); END;

DROP TRIGGER IF EXISTS trg_feed_records_corrections_only;
CREATE TRIGGER trg_feed_records_corrections_only BEFORE UPDATE ON feed_consumption_records
WHEN NEW.version <> OLD.version + 1 OR NEW.farm_id <> OLD.farm_id OR NEW.flock_id <> OLD.flock_id OR NEW.created_at <> OLD.created_at
  OR NOT EXISTS (SELECT 1 FROM production_record_corrections c WHERE c.record_type = 'feed' AND c.record_id = OLD.id AND c.version_to = NEW.version)
BEGIN SELECT RAISE(ABORT, 'Production records can only be changed through a correction with a reason.'); END;
DROP TRIGGER IF EXISTS trg_feed_records_no_delete;
CREATE TRIGGER trg_feed_records_no_delete BEFORE DELETE ON feed_consumption_records
WHEN EXISTS (SELECT 1 FROM farms WHERE id = OLD.farm_id)
BEGIN SELECT RAISE(ABORT, 'Production records cannot be deleted. Record a correction instead.'); END;

DROP TRIGGER IF EXISTS trg_water_records_corrections_only;
CREATE TRIGGER trg_water_records_corrections_only BEFORE UPDATE ON water_consumption_records
WHEN NEW.version <> OLD.version + 1 OR NEW.farm_id <> OLD.farm_id OR NEW.flock_id <> OLD.flock_id OR NEW.created_at <> OLD.created_at
  OR NOT EXISTS (SELECT 1 FROM production_record_corrections c WHERE c.record_type = 'water' AND c.record_id = OLD.id AND c.version_to = NEW.version)
BEGIN SELECT RAISE(ABORT, 'Production records can only be changed through a correction with a reason.'); END;
DROP TRIGGER IF EXISTS trg_water_records_no_delete;
CREATE TRIGGER trg_water_records_no_delete BEFORE DELETE ON water_consumption_records
WHEN EXISTS (SELECT 1 FROM farms WHERE id = OLD.farm_id)
BEGIN SELECT RAISE(ABORT, 'Production records cannot be deleted. Record a correction instead.'); END;

-- Correction history: never edited, never deleted while its farm exists.
DROP TRIGGER IF EXISTS trg_record_corrections_no_update;
CREATE TRIGGER trg_record_corrections_no_update BEFORE UPDATE ON production_record_corrections
BEGIN SELECT RAISE(ABORT, 'Correction history cannot be edited.'); END;
DROP TRIGGER IF EXISTS trg_record_corrections_no_delete;
CREATE TRIGGER trg_record_corrections_no_delete BEFORE DELETE ON production_record_corrections
WHEN EXISTS (SELECT 1 FROM farms WHERE id = OLD.farm_id)
BEGIN SELECT RAISE(ABORT, 'Correction history cannot be deleted.'); END;
-- ProductionRecords (end)

-- HealthObservations (begin)
CREATE TABLE IF NOT EXISTS health_observations (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id                     INTEGER NOT NULL,
  flock_id                    INTEGER NOT NULL,
  observation_date            TEXT    NOT NULL CHECK (observation_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  -- What was noticed, in the farmer's own words (free text, no symptom codes).
  observation                 TEXT    NOT NULL CHECK (length(trim(observation)) > 0 AND length(observation) <= 1000),
  -- Optional: NULL means the birds were not counted.
  birds_affected              INTEGER CHECK (birds_affected IS NULL OR birds_affected >= 1),
  action_taken                TEXT    CHECK (action_taken IS NULL OR (length(trim(action_taken)) > 0 AND length(action_taken) <= 1000)),
  vet_contacted               INTEGER NOT NULL DEFAULT 0 CHECK (vet_contacted IN (0, 1)),
  extension_officer_contacted INTEGER NOT NULL DEFAULT 0 CHECK (extension_officer_contacted IN (0, 1)),
  version                     INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by                  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at                  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flock_id, farm_id) REFERENCES flocks(id, farm_id) ON DELETE CASCADE
);
-- Several observations per flock and day are allowed (no unique index).
CREATE INDEX IF NOT EXISTS idx_health_observations_flock_date ON health_observations(flock_id, observation_date);
CREATE INDEX IF NOT EXISTS idx_health_observations_farm_date  ON health_observations(farm_id, observation_date);

CREATE TABLE IF NOT EXISTS health_observation_corrections (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id        INTEGER NOT NULL,
  flock_id       INTEGER NOT NULL,
  observation_id INTEGER NOT NULL REFERENCES health_observations(id) ON DELETE CASCADE,
  version_from   INTEGER NOT NULL CHECK (version_from >= 1),
  version_to     INTEGER NOT NULL CHECK (version_to = version_from + 1),
  changes        TEXT    NOT NULL CHECK (json_valid(changes)),   -- { field: { from, to } }
  reason         TEXT    NOT NULL CHECK (length(trim(reason)) > 0),
  corrected_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flock_id, farm_id) REFERENCES flocks(id, farm_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_health_corrections_version ON health_observation_corrections(observation_id, version_to);

-- Observations:
DROP TRIGGER IF EXISTS trg_health_observations_corrections_only;
CREATE TRIGGER trg_health_observations_corrections_only BEFORE UPDATE ON health_observations
WHEN NEW.version <> OLD.version + 1 OR NEW.farm_id <> OLD.farm_id OR NEW.flock_id <> OLD.flock_id OR NEW.created_at <> OLD.created_at
  OR NOT EXISTS (SELECT 1 FROM health_observation_corrections c WHERE c.observation_id = OLD.id AND c.version_to = NEW.version)
BEGIN SELECT RAISE(ABORT, 'Health observations can only be changed through a correction with a reason.'); END;
DROP TRIGGER IF EXISTS trg_health_observations_no_delete;
CREATE TRIGGER trg_health_observations_no_delete BEFORE DELETE ON health_observations
WHEN EXISTS (SELECT 1 FROM farms WHERE id = OLD.farm_id)
BEGIN SELECT RAISE(ABORT, 'Health observations cannot be deleted. Record a correction instead.'); END;

-- A correction belongs to the same farm and flock as its observation.
DROP TRIGGER IF EXISTS trg_health_corrections_same_flock;
CREATE TRIGGER trg_health_corrections_same_flock BEFORE INSERT ON health_observation_corrections
WHEN NOT EXISTS (SELECT 1 FROM health_observations o WHERE o.id = NEW.observation_id AND o.farm_id = NEW.farm_id AND o.flock_id = NEW.flock_id)
BEGIN SELECT RAISE(ABORT, 'A correction must belong to the same farm and flock as its health observation.'); END;

-- Correction history: never edited, never deleted while its farm exists.
DROP TRIGGER IF EXISTS trg_health_corrections_no_update;
CREATE TRIGGER trg_health_corrections_no_update BEFORE UPDATE ON health_observation_corrections
BEGIN SELECT RAISE(ABORT, 'Correction history cannot be edited.'); END;
DROP TRIGGER IF EXISTS trg_health_corrections_no_delete;
CREATE TRIGGER trg_health_corrections_no_delete BEFORE DELETE ON health_observation_corrections
WHEN EXISTS (SELECT 1 FROM farms WHERE id = OLD.farm_id)
BEGIN SELECT RAISE(ABORT, 'Correction history cannot be deleted.'); END;
-- HealthObservations (end)

-- Expenses (begin)
CREATE TABLE IF NOT EXISTS farm_expenses (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id           INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  flock_id          INTEGER,
  expense_date      TEXT    NOT NULL CHECK (expense_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  category          TEXT    NOT NULL CHECK (category IN ('feed', 'chicks', 'medication', 'equipment', 'labour', 'transport', 'other')),
  amount            INTEGER NOT NULL CHECK (amount > 0),   -- whole units of currency
  currency          TEXT    NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  description       TEXT    NOT NULL CHECK (length(trim(description)) > 0),
  voided            INTEGER NOT NULL DEFAULT 0 CHECK (voided IN (0, 1)),
  void_reason       TEXT,
  voided_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  voided_at         TEXT,
  legacy_expense_id INTEGER UNIQUE,                         -- expense_records.id it was copied from
  version           INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flock_id, farm_id) REFERENCES flocks(id, farm_id) ON DELETE CASCADE,
  -- A voided expense has its reason and time; an active one has neither.
  CHECK ((voided = 1) = (void_reason IS NOT NULL AND length(trim(void_reason)) > 0 AND voided_at IS NOT NULL)),
  CHECK (voided = 1 OR voided_by IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_farm_expenses_farm_date ON farm_expenses(farm_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_farm_expenses_flock     ON farm_expenses(flock_id);
CREATE INDEX IF NOT EXISTS idx_farm_expenses_category  ON farm_expenses(farm_id, category);

-- Correction history of expenses (including voiding).
CREATE TABLE IF NOT EXISTS expense_corrections (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id      INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  expense_id   INTEGER NOT NULL REFERENCES farm_expenses(id) ON DELETE CASCADE,
  version_from INTEGER NOT NULL CHECK (version_from >= 1),
  version_to   INTEGER NOT NULL CHECK (version_to = version_from + 1),
  changes      TEXT    NOT NULL CHECK (json_valid(changes)),   -- { field: { from, to } }
  reason       TEXT    NOT NULL CHECK (length(trim(reason)) > 0),
  corrected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_expense_corrections_version ON expense_corrections(expense_id, version_to);

-- Expenses:
DROP TRIGGER IF EXISTS trg_farm_expenses_corrections_only;
CREATE TRIGGER trg_farm_expenses_corrections_only BEFORE UPDATE ON farm_expenses
WHEN NEW.version <> OLD.version + 1 OR NEW.farm_id <> OLD.farm_id OR NEW.currency <> OLD.currency
  OR NEW.created_at <> OLD.created_at OR NEW.legacy_expense_id IS NOT OLD.legacy_expense_id
  OR NOT EXISTS (SELECT 1 FROM expense_corrections c WHERE c.expense_id = OLD.id AND c.version_to = NEW.version)
BEGIN SELECT RAISE(ABORT, 'Expenses can only be changed through a correction with a reason, and their currency never changes.'); END;
DROP TRIGGER IF EXISTS trg_farm_expenses_no_unvoid;
CREATE TRIGGER trg_farm_expenses_no_unvoid BEFORE UPDATE OF voided ON farm_expenses
WHEN OLD.voided = 1 AND NEW.voided = 0
BEGIN SELECT RAISE(ABORT, 'A voided expense cannot be un-voided.'); END;
DROP TRIGGER IF EXISTS trg_farm_expenses_no_delete;
CREATE TRIGGER trg_farm_expenses_no_delete BEFORE DELETE ON farm_expenses
WHEN EXISTS (SELECT 1 FROM farms WHERE id = OLD.farm_id)
BEGIN SELECT RAISE(ABORT, 'Expenses cannot be deleted. Void the expense with a correction instead.'); END;

-- A correction belongs to the same farm as its expense.
DROP TRIGGER IF EXISTS trg_expense_corrections_same_farm;
CREATE TRIGGER trg_expense_corrections_same_farm BEFORE INSERT ON expense_corrections
WHEN NOT EXISTS (SELECT 1 FROM farm_expenses e WHERE e.id = NEW.expense_id AND e.farm_id = NEW.farm_id)
BEGIN SELECT RAISE(ABORT, 'A correction must belong to the same farm as its expense.'); END;

-- Correction history: never edited, never deleted while its farm exists.
DROP TRIGGER IF EXISTS trg_expense_corrections_no_update;
CREATE TRIGGER trg_expense_corrections_no_update BEFORE UPDATE ON expense_corrections
BEGIN SELECT RAISE(ABORT, 'Correction history cannot be edited.'); END;
DROP TRIGGER IF EXISTS trg_expense_corrections_no_delete;
CREATE TRIGGER trg_expense_corrections_no_delete BEFORE DELETE ON expense_corrections
WHEN EXISTS (SELECT 1 FROM farms WHERE id = OLD.farm_id)
BEGIN SELECT RAISE(ABORT, 'Correction history cannot be deleted.'); END;
-- Expenses (end)


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
  updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Poultry Guidance module 
  code               TEXT,                     
  summary            TEXT,
  stages             TEXT CHECK (stages IS NULL OR json_valid(stages)),         
  steps              TEXT CHECK (steps IS NULL OR json_valid(steps)),
  key_values         TEXT CHECK (key_values IS NULL OR json_valid(key_values)),  
  notice             TEXT,                       
  evidence_labels    TEXT CHECK (evidence_labels IS NULL OR json_valid(evidence_labels)),
  sources            TEXT CHECK (sources IS NULL OR json_valid(sources)),
  source_differences TEXT,
  strain_note        TEXT,                       
  referral           TEXT,
  related_codes      TEXT CHECK (related_codes IS NULL OR json_valid(related_codes)),
  keywords           TEXT CHECK (keywords IS NULL OR json_valid(keywords)),
  content_version    INTEGER CHECK (content_version IS NULL OR content_version >= 1),
  reviewed_on        TEXT,
  is_active          INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order         INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_poultry_guidance_code ON poultry_guidance(code);

-- Indexes: speed up the most common lookups (records for one farm)

CREATE INDEX IF NOT EXISTS idx_memberships_user   ON farm_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_flocks_farm        ON flocks(farm_id);
CREATE INDEX IF NOT EXISTS idx_assessments_farm   ON readiness_assessments(farm_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assess   ON resource_checklist_items(assessment_id);
CREATE INDEX IF NOT EXISTS idx_tasks_farm         ON daily_tasks(farm_id);
CREATE INDEX IF NOT EXISTS idx_activities_farm    ON farm_activity_records(farm_id);
CREATE INDEX IF NOT EXISTS idx_activities_flock   ON farm_activity_records(flock_id);
CREATE INDEX IF NOT EXISTS idx_expenses_farm      ON expense_records(farm_id);
