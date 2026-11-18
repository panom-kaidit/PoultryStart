// Database reads for poultry guidance articles:
const { getDb } = require('../config/database');

const JSON_COLUMNS = ['stages', 'steps', 'key_values', 'evidence_labels', 'sources', 'related_codes', 'keywords'];
const parse = (row, column) => (row[column] == null ? null : JSON.parse(row[column]));

function toArticle(row) {
  if (!row) return null;
  const json = Object.fromEntries(JSON_COLUMNS.map((c) => [c, parse(row, c)]));
  return {
    code: row.code,
    title: row.title,
    topic: row.topic,
    poultryType: row.poultry_type,
    stages: json.stages,
    summary: row.summary,
    notice: row.notice,
    steps: json.steps || [],
    keyValues: json.key_values || [],
    sourceDifferences: row.source_differences,
    limits: row.strain_note,
    referral: row.referral,
    evidenceLabels: json.evidence_labels || [],
    sources: json.sources || [],
    relatedCodes: json.related_codes || [],
    keywords: json.keywords || [],
    contentVersion: row.content_version,
    reviewedOn: row.reviewed_on,
    sortOrder: row.sort_order,
  };
}

const VISIBLE = 'code IS NOT NULL AND is_active = 1';

// Escapes LIKE wildcards in a search word.
const likePattern = (word) => `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// Active coded articles, optionally of one topic and poultry types
function list({ topic, poultryTypes, words = [] } = {}) {
  const where = [VISIBLE];
  const params = [];
  if (topic) { where.push('topic = ?'); params.push(topic); }
  if (poultryTypes) { where.push(`poultry_type IN (${poultryTypes.map(() => '?').join(', ')})`); params.push(...poultryTypes); }
  for (const word of words) {
    where.push("(title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\' OR keywords LIKE ? ESCAPE '\\')");
    const pattern = likePattern(word);
    params.push(pattern, pattern, pattern, pattern);
  }
  return getDb()
    .prepare(`SELECT * FROM poultry_guidance WHERE ${where.join(' AND ')} ORDER BY sort_order, code`)
    .all(...params)
    .map(toArticle);
}

function findByCode(code) {
  return toArticle(getDb().prepare(`SELECT * FROM poultry_guidance WHERE ${VISIBLE} AND code = ?`).get(code));
}

// Titles of active articles by code (for links).
function titlesFor(codes) {
  if (codes.length === 0) return new Map();
  const rows = getDb()
    .prepare(`SELECT code, title FROM poultry_guidance WHERE ${VISIBLE} AND code IN (${codes.map(() => '?').join(', ')})`)
    .all(...codes);
  return new Map(rows.map((r) => [r.code, r.title]));
}

// Number of active articles per topic.
function countByTopic() {
  return new Map(getDb()
    .prepare(`SELECT topic, COUNT(*) AS n FROM poultry_guidance WHERE ${VISIBLE} GROUP BY topic`)
    .all()
    .map((r) => [r.topic, r.n]));
}

module.exports = { list, findByCode, titlesFor, countByTopic };
