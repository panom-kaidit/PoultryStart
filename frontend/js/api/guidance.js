// Guidance endpoints
import { get } from './client.js';
import { queryString } from './production.js';

export function listArticles({ poultryType, topic, stage, q } = {}) {
  return get(`/guidance${queryString({ poultryType, topic, stage, q })}`);
}


let topicsRequest = null;
export function getTopics() {
  if (!topicsRequest) topicsRequest = get('/guidance/topics').catch((error) => { topicsRequest = null; throw error; });
  return topicsRequest;
}

export function getArticle(code) {
  return get(`/guidance/${encodeURIComponent(code)}`);
}
