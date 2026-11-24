// Display helpers for the Flocks Management and Flock hub screens.
export function splitFlocks(flocks) {
  return {
    active: flocks.filter((f) => f.status === 'active'),
    closed: flocks.filter((f) => f.status !== 'active'),
  };
}

export const shortLabel = (label) => String(label || '').split(':')[0].trim();

export function stageBar(topicStages, poultryType, stage) {
  const list = (topicStages?.[poultryType] || []).filter((s) => s.stage !== 'preparation' && s.stage !== 'after_flock');
  const current = list.findIndex((s) => s.stage === stage);
  if (!stage || current < 0) return null;
  return { stages: list.map((s) => ({ stage: s.stage, label: shortLabel(s.label) })), current };
}

export const closedOn = (flock) => (flock.closedAt ? String(flock.closedAt).slice(0, 10) : null);

export const CLOSURE_REASONS = { completed: 'Completed', ended_early: 'Ended early' };
export const closureReasonText = (flock) => CLOSURE_REASONS[flock.closureReason] || 'Not given';

export const laying = (flock, today) => flock.poultryType === 'layer' && Boolean(flock.firstEggDate) && flock.firstEggDate <= today;

export function hubTabs({ canSeeMoney }) {
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'History' },
    { id: 'health', label: 'Health' },
    ...(canSeeMoney ? [{ id: 'money', label: 'Money' }] : []),
    { id: 'details', label: 'Details' },
  ];
}

export const pickTab = (requested, tabs) => (tabs.some((t) => t.id === requested) ? requested : 'overview');
