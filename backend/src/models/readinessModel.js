// Database operations for readiness assessments, 
const { getDb } = require('../config/database');

function toAssessment(row) {
  if (!row) return null;
  return {
    id: row.id,
    farmId: row.farm_id,
    poultryType: row.poultry_type,
    startingStage: row.starting_stage || 'day_old',
    startingAgeWeeks: row.starting_age_weeks,
    densityMode: row.density_mode,
    assessmentDate: row.assessment_date,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toQuestion(row) {
  return {
    id: row.id,
    code: row.code,
    area: row.area,
    questionText: row.question_text,
    helpText: row.help_text,
    startingStages: (row.starting_stages || 'all').split(','),
    verificationNote: row.verification_note,
    poultryType: row.poultry_type,
    isRequired: row.is_required === 1,
    neededBy: row.needed_by,
  };
}

function toResponse(row) {
  return {
    questionId: row.question_id,
    answer: row.answer,
    notes: row.notes,
    answeredBy: row.answered_by,
    answeredAt: row.updated_at,
  };
}

// ---- Assessments -----------------------------------------------------

function createAssessment(farmId, { poultryType, startingStage, startingAgeWeeks, densityMode }) {
  const result = getDb()
    .prepare(
      `INSERT INTO readiness_assessments
         (farm_id, poultry_type, starting_stage, starting_age_weeks, density_mode)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(farmId, poultryType, startingStage, startingAgeWeeks ?? null, densityMode);
  return findAssessmentById(result.lastInsertRowid);
}

function findAssessmentById(id) {
  return toAssessment(getDb().prepare('SELECT * FROM readiness_assessments WHERE id = ?').get(id));
}

function findAssessment(farmId, assessmentId) {
  const row = getDb()
    .prepare('SELECT * FROM readiness_assessments WHERE id = ? AND farm_id = ?')
    .get(assessmentId, farmId);
  return toAssessment(row);
}

// Newest first: the first one is the farm's current assessment.
function findAssessmentsForFarm(farmId) {
  const rows = getDb()
    .prepare('SELECT * FROM readiness_assessments WHERE farm_id = ? ORDER BY created_at DESC, id DESC')
    .all(farmId);
  return rows.map(toAssessment);
}

function updateStatus(assessmentId, status, completedAt) {
  getDb()
    .prepare(
      `UPDATE readiness_assessments
          SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    )
    .run(status, completedAt, assessmentId);
}

// ---- Questions -------------------------------------------------------

function findQuestionsFor(poultryType) {
  const rows = getDb()
    .prepare(
      `SELECT * FROM readiness_questions
        WHERE poultry_type IN ('all', ?)
        ORDER BY sort_order, id`
    )
    .all(poultryType);
  return rows.map(toQuestion);
}

// ---- Responses -------------------------------------------------------

function findResponses(assessmentId) {
  const rows = getDb()
    .prepare('SELECT * FROM readiness_responses WHERE assessment_id = ?')
    .all(assessmentId);
  return rows.map(toResponse);
}

// Saves an answers

function saveResponse({ assessmentId, questionId, answer, notes, userId }) {
  getDb()
    .prepare(
      `INSERT INTO readiness_responses (assessment_id, question_id, answer, notes, answered_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (assessment_id, question_id) DO UPDATE SET
         answer = excluded.answer,
         notes = excluded.notes,
         answered_by = excluded.answered_by,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run(assessmentId, questionId, answer, notes, userId);
}

module.exports = {
  createAssessment,
  findAssessment,
  findAssessmentsForFarm,
  updateStatus,
  findQuestionsFor,
  findResponses,
  saveResponse,
};
