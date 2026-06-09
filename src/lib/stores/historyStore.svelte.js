let history = $state([]);

export function getHistory() {
  return history;
}

export function pushHistory(entry) {
  history = [...history, entry];
}

export function popHistory() {
  if (history.length === 0) return null;
  const entry = history[history.length - 1];
  history = history.slice(0, -1);
  return entry;
}

export function clearHistory() {
  history = [];
}

export function removeEntry(entry) {
  const idx = history.indexOf(entry);
  if (idx !== -1) {
    history = history.filter((_, i) => i !== idx);
  }
}

export function hasHistory() {
  return history.length > 0;
}

export function getHistoryLength() {
  return history.length;
}
