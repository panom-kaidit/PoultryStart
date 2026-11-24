// Keeps the last loaded task list in memory for the open farm.
import { onFarmCleared } from './farm.js';

let cache = null;

export function getCachedTasks(farmId) {
  return cache && cache.farmId === farmId ? cache : null;
}

export function setCachedTasks(farmId, tasks) {
  cache = { farmId, tasks, loadedAt: new Date() };
}

export function updateCachedTask(farmId, task) {
  if (!cache || cache.farmId !== farmId) return;
  const index = cache.tasks.findIndex((t) => t.id === task.id);
  if (index >= 0) cache.tasks[index] = task;
  else cache.tasks.push(task);
}

export function clearTaskCache() {
  cache = null;
}

onFarmCleared(clearTaskCache);
