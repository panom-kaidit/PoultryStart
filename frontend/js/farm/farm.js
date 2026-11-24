// Holds the one open farm and the user's role on it.
import { getFarm } from '../api/farms.js';

let current = null;
let loading = null;

export function getCurrentFarm() {
  return current;
}

const clearListeners = [];
export function onFarmCleared(listener) {
  clearListeners.push(listener);
}

export function clearFarm() {
  current = null;
  loading = null;
  for (const listener of clearListeners) listener();
}

export function setCurrentFarm(farm, capacity) {
  if (current && current.farm.id === farm.id) current = { farm: { ...current.farm, ...farm }, capacity };
}

export async function openFarm(farmId) {
  if (current && current.farm.id === farmId) return current;
  if (loading && loading.farmId === farmId) return loading.promise;

  clearFarm();
  const promise = getFarm(farmId).then(({ data }) => {
    if (loading && loading.promise === promise) {
      current = { farm: data.farm, capacity: data.capacity };
      loading = null;
    }
    return { farm: data.farm, capacity: data.capacity };
  }).catch((error) => {
    if (loading && loading.promise === promise) loading = null;
    throw error;
  });
  loading = { farmId, promise };
  return promise;
}
