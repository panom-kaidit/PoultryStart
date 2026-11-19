// Handles poultry guidance browsing, filtering and search.
const guidanceModel = require('../models/guidanceModel');
const AppError = require('../utils/AppError');
const {
  TOPICS, STAGES, MARKERS, SOURCE_TYPES, EVIDENCE_LABELS, CATALOGUE, guidanceCodesForTask, stageQualification,
} = require('../data/guidanceContent');

function matchesStage(article, stage, poultryType) {
  if (article.stages === 'any') return true;
  if (stage === 'any') return false;
  if (poultryType && poultryType !== 'all') return (article.stages[poultryType] || []).includes(stage);
  return Object.values(article.stages).some((list) => list.includes(stage));
}

const evidenceOf = (codes) => codes.map((code) => ({ code, ...SOURCE_TYPES[code] }));

const summaryOf = (a) => ({
  code: a.code,
  title: a.title,
  topic: a.topic,
  topicLabel: TOPICS[a.topic],
  poultryType: a.poultryType,
  stages: a.stages,
  summary: a.summary,
  evidenceLabels: a.evidenceLabels,
  path: `/api/guidance/${a.code}`,
});

function linksFor(codes) {
  const titles = guidanceModel.titlesFor(codes);
  return codes.filter((code) => titles.has(code)).map((code) => ({ code, title: titles.get(code), path: `/api/guidance/${code}` }));
}

function listArticles(query) {
  const { poultryType, topic, stage } = query;
  let poultryTypes;
  if (poultryType === 'all') poultryTypes = ['all'];
  else if (poultryType) poultryTypes = [poultryType, 'all'];
  const words = query.q ? query.q.trim().split(/\s+/).filter(Boolean) : [];
  let articles = guidanceModel.list({ topic, poultryTypes, words });
  if (stage) articles = articles.filter((a) => matchesStage(a, stage, poultryType));
  return {
    filters: { poultryType: poultryType || null, topic: topic || null, stage: stage || null, q: query.q ? query.q.trim() : null },
    count: articles.length,
    articles: articles.map(summaryOf),
  };
}

function getArticle(code) {
  const article = guidanceModel.findByCode(code);
  if (!article) throw new AppError(404, 'Guidance article not found.');
  const { sortOrder, relatedCodes, evidenceLabels, ...rest } = article;
  return {
    ...rest,
    topicLabel: TOPICS[article.topic],
    evidenceLabels: evidenceOf(evidenceLabels),
    relatedArticles: linksFor(relatedCodes),
  };
}

function listTopics() {
  const counts = guidanceModel.countByTopic();
  return {
    catalogue: CATALOGUE,
    topics: Object.entries(TOPICS).map(([topic, label]) => ({ topic, label, articleCount: counts.get(topic) || 0 })),
    poultryTypes: [
      { poultryType: 'broiler', label: 'Broilers (articles for broilers and for both types)' },
      { poultryType: 'layer', label: 'Layers (articles for layers and for both types)' },
      { poultryType: 'all', label: 'Articles for both types only' },
    ],
    stages: Object.fromEntries(Object.entries(STAGES).map(([type, stages]) =>
      [type, Object.entries(stages).map(([stage, label]) => ({ stage, label, ...stageQualification(type, stage) }))])),
    evidenceLabels: evidenceOf(EVIDENCE_LABELS),
    markers: Object.values(MARKERS).map(({ label, qualification }) => ({ label, qualification })),
  };
}

const taskGuidanceLinks = (templateCode, poultryType) => linksFor(guidanceCodesForTask(templateCode, poultryType));

module.exports = { listArticles, getArticle, listTopics, taskGuidanceLinks, linksFor, matchesStage };
