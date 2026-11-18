// Opens the SQLite database and creates the tables from database/schema.sql.

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./env');
const { READINESS_QUESTIONS } = require('../data/readinessContent');
const { guidanceRows } = require('../data/guidanceContent');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const SCHEMA_FILE = path.join(BACKEND_ROOT, 'database', 'schema.sql');

let db = null;

function getDb() {
  if (db) return db;

  const inMemory = config.dbPath === ':memory:'; // used by the automated tests
  const filePath = inMemory ? ':memory:' : path.resolve(BACKEND_ROOT, config.dbPath);
  if (!inMemory) fs.mkdirSync(path.dirname(filePath), { recursive: true });

  db = new Database(filePath);
  db.pragma('foreign_keys = ON'); 
  if (!inMemory) db.pragma('journal_mode = WAL');
  checkSchemaIsSupported(db);
  runMigrations(db);
  db.exec(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  backfillFlockMovements(db);
  copyLegacyExpenses(db);
  syncReadinessQuestions(db);
  syncGuidance(db);
  return db;
}

// Databases created before the readiness module (no "code" column) cannot be
// upgraded automatically. Stop with a clear message.
function checkSchemaIsSupported(database) {
  const columns = database.prepare('PRAGMA table_info(readiness_questions)').all().map((c) => c.name);
  if (columns.length === 0) return; // no such table yet: schema.sql will create it
  if (!columns.includes('code')) {
    throw new Error(
      'The database file was created before the readiness module and cannot be upgraded. ' +
      'Back it up, then delete database/poultrystart.db (and its -wal/-shm files) and start again.'
    );
  }
 
  const table = database.prepare("SELECT sql FROM sqlite_master WHERE name = 'readiness_questions'").get();
  if (table.sql.includes('needed_by') && !table.sql.includes('before_sale')) {
    throw new Error(
      'This database file was created by an uncommitted development version (11 Nov 2026) and ' +
      'cannot be upgraded. Back it up, then delete database/poultrystart.db (and its -wal/-shm ' +
      'files) and start again.'
    );
  }
}

// ---------------------------------------------------------------------
// Migrations: safe, additive changes for EXISTING database files.
// "CREATE TABLE IF NOT EXISTS" never changes a table that already exists,

const MIGRATIONS = [
  { table: 'farms', column: 'house_status',
    definition: "TEXT CHECK (house_status IS NULL OR house_status IN ('existing', 'not_built'))" },
  { table: 'readiness_questions', column: 'help_text', definition: 'TEXT' },
  { table: 'farms', column: 'starting_stage', definition: "TEXT NOT NULL DEFAULT 'day_old' CHECK (starting_stage IN ('day_old', 'pullet', 'point_of_lay'))" },
  { table: 'farms', column: 'starting_age_weeks', definition: 'INTEGER CHECK (starting_age_weeks IS NULL OR (starting_age_weeks >= 0 AND starting_age_weeks <= 100))' },
  { table: 'readiness_assessments', column: 'starting_stage', definition: "TEXT NOT NULL DEFAULT 'day_old' CHECK (starting_stage IN ('day_old', 'pullet', 'point_of_lay'))" },
  { table: 'readiness_assessments', column: 'starting_age_weeks', definition: 'INTEGER CHECK (starting_age_weeks IS NULL OR (starting_age_weeks >= 0 AND starting_age_weeks <= 100))' },
  { table: 'readiness_assessments', column: 'density_mode', definition: "TEXT CHECK (density_mode IS NULL OR density_mode IN ('standard', 'conservative'))",
    // Existing assessments keep the density mode they were already shown with.
    backfill: `UPDATE readiness_assessments
                  SET density_mode = (SELECT CASE experience_level WHEN 'beginner' THEN 'conservative' ELSE 'standard' END
                                        FROM farms WHERE farms.id = readiness_assessments.farm_id)
                WHERE density_mode IS NULL` },
  { table: 'readiness_questions', column: 'starting_stages', definition: "TEXT NOT NULL DEFAULT 'all'" },
  { table: 'readiness_questions', column: 'verification_note', definition: 'TEXT' },
  { table: 'farms', column: 'house_length_m',
    definition: 'REAL CHECK (house_length_m IS NULL OR house_length_m > 0)' },
  { table: 'farms', column: 'house_width_m',
    definition: 'REAL CHECK (house_width_m IS NULL OR house_width_m > 0)' },
  { table: 'farms', column: 'non_usable_area_m2',
    definition: 'REAL CHECK (non_usable_area_m2 IS NULL OR non_usable_area_m2 >= 0)' },
  { table: 'readiness_assessments', column: 'poultry_type',
    definition: "TEXT CHECK (poultry_type IN ('broiler', 'layer'))",
    // Existing assessments take their farm's current poultry type.
    backfill: `UPDATE readiness_assessments
                  SET poultry_type = (SELECT poultry_type FROM farms WHERE farms.id = readiness_assessments.farm_id)
                WHERE poultry_type IS NULL` },
  { table: 'readiness_questions', column: 'needed_by',
    definition: "TEXT NOT NULL DEFAULT 'chick_arrival' CHECK (needed_by IN ('chick_arrival', 'before_transfer', 'before_first_egg', 'before_sale'))" },
  { table: 'resource_checklist_items', column: 'needed_by',
    definition: "TEXT NOT NULL DEFAULT 'chick_arrival' CHECK (needed_by IN ('chick_arrival', 'before_transfer', 'before_first_egg', 'before_sale'))" },
  { table: 'flocks', column: 'starting_stage', definition: "TEXT NOT NULL DEFAULT 'day_old' CHECK (starting_stage IN ('day_old', 'pullet', 'point_of_lay'))" },
  { table: 'flocks', column: 'age_at_arrival_weeks', definition: 'INTEGER CHECK (age_at_arrival_weeks IS NULL OR (age_at_arrival_weeks >= 0 AND age_at_arrival_weeks <= 100))' },
  { table: 'flocks', column: 'breed_strain', definition: 'TEXT' },
  { table: 'flocks', column: 'supplier', definition: 'TEXT' },
  { table: 'flocks', column: 'males_received', definition: 'INTEGER CHECK (males_received IS NULL OR males_received >= 0)' },
  { table: 'flocks', column: 'females_received', definition: 'INTEGER CHECK (females_received IS NULL OR females_received >= 0)' },
  { table: 'flocks', column: 'vaccination_notes', definition: 'TEXT' },
  { table: 'flocks', column: 'notes', definition: 'TEXT' },
  { table: 'flocks', column: 'capacity_status', definition: "TEXT CHECK (capacity_status IS NULL OR capacity_status IN ('incomplete', 'house_not_built', 'above_capacity', 'within_capacity'))" },
  { table: 'flocks', column: 'recommended_capacity', definition: 'INTEGER CHECK (recommended_capacity IS NULL OR recommended_capacity >= 0)' },
  { table: 'flocks', column: 'density_mode', definition: "TEXT CHECK (density_mode IS NULL OR density_mode IN ('standard', 'conservative'))" },
  { table: 'flocks', column: 'closed_at', definition: 'TEXT' },
  { table: 'flocks', column: 'closure_reason', definition: "TEXT CHECK (closure_reason IS NULL OR closure_reason IN ('completed', 'ended_early'))" },
  { table: 'flocks', column: 'closure_notes', definition: 'TEXT' },
  { table: 'flocks', column: 'created_by', definition: 'INTEGER REFERENCES users(id) ON DELETE SET NULL' },
  { table: 'flock_bird_movements', column: 'replaces_movement_id',
    definition: "INTEGER REFERENCES flock_bird_movements(id) ON DELETE CASCADE CHECK (replaces_movement_id IS NULL OR movement_type = 'correction')" },
  { table: 'flock_bird_movements', column: 'correction_amount',
    definition: "INTEGER CHECK (correction_amount IS NULL OR movement_type = 'correction')",
    backfill: `DROP TRIGGER IF EXISTS trg_movements_no_update;
               UPDATE flock_bird_movements SET correction_amount = bird_change
                WHERE movement_type = 'correction' AND correction_amount IS NULL;` },
  { table: 'flock_bird_movements', column: 'birds_age_weeks',
    definition: "INTEGER CHECK (birds_age_weeks IS NULL OR (birds_age_weeks BETWEEN 0 AND 100 AND movement_type = 'additional_received'))" },
  { table: 'daily_tasks', column: 'flock_id', definition: 'INTEGER REFERENCES flocks(id) ON DELETE CASCADE' },
  { table: 'daily_tasks', column: 'source', definition: "TEXT NOT NULL DEFAULT 'custom' CHECK (source IN ('custom', 'generated'))" },
  { table: 'daily_tasks', column: 'template_code', definition: 'TEXT' },
  { table: 'daily_tasks', column: 'frequency', definition: "TEXT NOT NULL DEFAULT 'once' CHECK (frequency IN ('daily', 'interval', 'weekly', 'once'))" },
  { table: 'daily_tasks', column: 'time_slot', definition: "TEXT NOT NULL DEFAULT 'any' CHECK (time_slot IN ('morning', 'midday', 'evening', 'any'))" },
  { table: 'daily_tasks', column: 'occurrence', definition: 'INTEGER NOT NULL DEFAULT 1 CHECK (occurrence >= 1)' },
  { table: 'daily_tasks', column: 'generation_key', definition: "TEXT CHECK ((source = 'generated') = (generation_key IS NOT NULL))" },
  { table: 'daily_tasks', column: 'completion_notes', definition: 'TEXT' },
  { table: 'daily_tasks', column: 'problem_reported', definition: 'INTEGER NOT NULL DEFAULT 0 CHECK (problem_reported IN (0, 1))' },
  { table: 'daily_tasks', column: 'cancel_reason', definition: 'TEXT' },
  { table: 'daily_tasks', column: 'cancelled_by', definition: 'INTEGER REFERENCES users(id) ON DELETE SET NULL' },
  { table: 'daily_tasks', column: 'cancelled_at',
    definition: "TEXT CHECK (cancelled_at IS NULL OR (status = 'pending' AND cancel_reason IS NOT NULL AND length(trim(cancel_reason)) > 0))" },
  { table: 'flocks', column: 'first_egg_date',
    definition: "TEXT CHECK (first_egg_date IS NULL OR (poultry_type = 'layer' AND first_egg_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND first_egg_date >= start_date))" },
  { table: 'flocks', column: 'expected_sale_date',
    definition: "TEXT CHECK (expected_sale_date IS NULL OR (poultry_type = 'broiler' AND expected_sale_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND expected_sale_date >= start_date))" },

  { table: 'weight_records', column: 'entered_unit', definition: "TEXT CHECK (entered_unit IS NULL OR entered_unit IN ('g', 'kg'))" },
  { table: 'weight_records', column: 'entered_weights', definition: 'TEXT CHECK (entered_weights IS NULL OR json_valid(entered_weights))' },
  { table: 'weight_records', column: 'entered_average_weight', definition: 'REAL CHECK (entered_average_weight IS NULL OR entered_average_weight > 0)' },

  { table: 'poultry_guidance', column: 'code', definition: 'TEXT' },
  { table: 'poultry_guidance', column: 'summary', definition: 'TEXT' },
  { table: 'poultry_guidance', column: 'stages', definition: 'TEXT CHECK (stages IS NULL OR json_valid(stages))' },
  { table: 'poultry_guidance', column: 'steps', definition: 'TEXT CHECK (steps IS NULL OR json_valid(steps))' },
  { table: 'poultry_guidance', column: 'key_values', definition: 'TEXT CHECK (key_values IS NULL OR json_valid(key_values))' },
  { table: 'poultry_guidance', column: 'notice', definition: 'TEXT' },
  { table: 'poultry_guidance', column: 'evidence_labels', definition: 'TEXT CHECK (evidence_labels IS NULL OR json_valid(evidence_labels))' },
  { table: 'poultry_guidance', column: 'sources', definition: 'TEXT CHECK (sources IS NULL OR json_valid(sources))' },
  { table: 'poultry_guidance', column: 'source_differences', definition: 'TEXT' },
  { table: 'poultry_guidance', column: 'strain_note', definition: 'TEXT' },
  { table: 'poultry_guidance', column: 'referral', definition: 'TEXT' },
  { table: 'poultry_guidance', column: 'related_codes', definition: 'TEXT CHECK (related_codes IS NULL OR json_valid(related_codes))' },
  { table: 'poultry_guidance', column: 'keywords', definition: 'TEXT CHECK (keywords IS NULL OR json_valid(keywords))' },
  { table: 'poultry_guidance', column: 'content_version', definition: 'INTEGER CHECK (content_version IS NULL OR content_version >= 1)' },
  { table: 'poultry_guidance', column: 'reviewed_on', definition: 'TEXT' },
  { table: 'poultry_guidance', column: 'is_active', definition: 'INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))' },
  { table: 'poultry_guidance', column: 'sort_order', definition: 'INTEGER' },
];

function runMigrations(database) {
  const columnsOf = (table) => database.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

  database.transaction(() => {
    for (const m of MIGRATIONS) {
      const columns = columnsOf(m.table);
      if (columns.length > 0 && !columns.includes(m.column)) {
        database.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.definition}`);
        if (m.backfill) database.exec(m.backfill);
      }
    }
  })();
}

function backfillFlockMovements(database) {
  const note = 'Added automatically when the bird movement history was introduced.';
  database.transaction(() => {
    const oldFlocks = database.prepare(
      `SELECT id FROM flocks
        WHERE NOT EXISTS (SELECT 1 FROM flock_bird_movements m WHERE m.flock_id = flocks.id)
        ORDER BY id`
    ).all();
    for (const { id } of oldFlocks) {
      database.prepare(
        `INSERT INTO flock_bird_movements (farm_id, flock_id, movement_type, bird_change, movement_date, notes, created_at)
         SELECT farm_id, id, 'received', initial_bird_count,
                COALESCE(date(start_date), date(created_at)), ?, created_at
           FROM flocks WHERE id = ?`
      ).run(note, id);
      database.prepare(
        `INSERT INTO flock_bird_movements (farm_id, flock_id, movement_type, bird_change, movement_date, notes, recorded_by, created_at)
         SELECT f.farm_id, a.flock_id, 'mortality', -a.birds_lost,
                COALESCE(date(a.activity_date), date(a.created_at)),
                CASE WHEN a.notes IS NULL THEN ? ELSE a.notes || ' (' || ? || ')' END,
                a.recorded_by, a.created_at
           FROM farm_activity_records a
           JOIN flocks f ON f.id = a.flock_id   -- the flock's own farm
          WHERE a.flock_id = ? AND a.activity_type = 'mortality'
          ORDER BY a.activity_date, a.id`
      ).run(note, note, id);
    }
  })();
}

// Expenses module: copy the old expense_records into the new farm_expenses table, with a link
function copyLegacyExpenses(database) {
  database.prepare(
    `INSERT INTO farm_expenses (farm_id, flock_id, expense_date, category, amount, currency, description,
                                legacy_expense_id, created_by, created_at, updated_at)
     SELECT r.farm_id, NULL,
            COALESCE(date(r.expense_date), date(r.created_at)),
            r.category, r.amount, upper(f.currency),
            COALESCE(NULLIF(trim(r.notes), ''), 'Expense copied from the earlier expense records (' || r.category || ').'),
            r.id, r.recorded_by, r.created_at, r.updated_at
       FROM expense_records r
       JOIN farms f ON f.id = r.farm_id
      WHERE upper(f.currency) GLOB '[A-Z][A-Z][A-Z]'
        AND NOT EXISTS (SELECT 1 FROM farm_expenses e WHERE e.legacy_expense_id = r.id)
      ORDER BY r.id`
  ).run();
}

// Poultry Guidance:
const GUIDANCE_COLUMNS = {
  title: 'title', topic: 'topic', poultry_type: 'poultryType', content: 'content', source: 'source', summary: 'summary',
  stages: 'stages', steps: 'steps', key_values: 'keyValues', notice: 'notice', evidence_labels: 'evidenceLabels',
  sources: 'sources', source_differences: 'sourceDifferences', strain_note: 'strainNote', referral: 'referral',
  related_codes: 'relatedCodes', keywords: 'keywords', content_version: 'contentVersion', reviewed_on: 'reviewedOn',
  sort_order: 'sortOrder',
};

function syncGuidance(database, rows = guidanceRows()) {
  const columns = Object.keys(GUIDANCE_COLUMNS);
  const upsert = database.prepare(
    `INSERT INTO poultry_guidance (code, ${columns.join(', ')}, is_active)
     VALUES (@code, ${columns.map((c) => `@${GUIDANCE_COLUMNS[c]}`).join(', ')}, 1)
     ON CONFLICT (code) DO UPDATE SET
       ${columns.map((c) => `${c} = excluded.${c}`).join(', ')}, is_active = 1, updated_at = CURRENT_TIMESTAMP
     WHERE poultry_guidance.is_active = 0
        OR ${columns.map((c) => `poultry_guidance.${c} IS NOT excluded.${c}`).join(' OR ')}`
  );
  database.transaction(() => {
    for (const row of rows) upsert.run(row);
    const codes = rows.map((r) => r.code);
    database.prepare(
      `UPDATE poultry_guidance SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE code IS NOT NULL AND is_active = 1 AND code NOT IN (${codes.map(() => '?').join(', ')})`
    ).run(...codes);
  })();
}

function syncReadinessQuestions(database) {
  const upsert = database.prepare(
    `INSERT INTO readiness_questions (code, area, question_text, help_text, poultry_type, is_required, needed_by,
                                      starting_stages, verification_note, sort_order)
     VALUES (@code, @area, @text, @helpText, @poultryType, @isRequired, @neededBy,
             @startingStages, @verificationNote, @sortOrder)
     ON CONFLICT (code) DO UPDATE SET
       area = excluded.area,
       question_text = excluded.question_text,
       help_text = excluded.help_text,
       starting_stages = excluded.starting_stages,
       verification_note = excluded.verification_note,
       poultry_type = excluded.poultry_type,
       is_required = excluded.is_required,
       needed_by = excluded.needed_by,
       sort_order = excluded.sort_order`
  );
  database.transaction(() => {
    READINESS_QUESTIONS.forEach((q, index) => {
      upsert.run({
        ...q,
        isRequired: q.required ? 1 : 0,
        neededBy: q.neededBy || 'chick_arrival',
        helpText: q.helpText || null,
        startingStages: (q.startingStages || ['all']).join(','),
        verificationNote: q.verificationNote || null,
        sortOrder: index + 1,
      });
    });
  })();
}


function runInTransaction(work) {
  return getDb().transaction(work)();
}


function runInImmediateTransaction(work) {
  return getDb().transaction(work).immediate();
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, runInTransaction, runInImmediateTransaction, closeDb, syncGuidance };
