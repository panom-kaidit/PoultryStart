// Handles HTTP requests for poultry guidance:
const service = require('../services/guidanceService');
const { sendSuccess } = require('../utils/response');
const { GUIDANCE_DISCLAIMER } = require('../data/guidanceContent');

function list(req, res) {
  sendSuccess(res, 200, { ...service.listArticles(req.query), disclaimer: GUIDANCE_DISCLAIMER });
}

function topics(req, res) {
  sendSuccess(res, 200, { ...service.listTopics(), disclaimer: GUIDANCE_DISCLAIMER });
}

function get(req, res) {
  sendSuccess(res, 200, { article: service.getArticle(req.params.code), disclaimer: GUIDANCE_DISCLAIMER });
}

module.exports = { list, topics, get };
