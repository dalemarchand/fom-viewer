let appspace = $state(null);

export function getAppspace() {
  return appspace;
}

export function setAppspace(data) {
  appspace = data;
}

export function clearAppspace() {
  appspace = null;
}

export function getTotalCount() {
  if (!appspace) return 0;
  return (appspace.entries?.length || 0) +
         (appspace.interactions?.length || 0) +
         (appspace.unknown?.length || 0);
}

export function hasAppspace() {
  return appspace !== null;
}

export function getAppsForClass(className) {
  if (!appspace) return [];
  const results = [];
  const search = (entries) => {
    if (!entries) return;
    for (const entry of entries) {
      if (entry.className === className || entry.matchedClass === className) {
        for (const app of entry.apps) {
          const appStr = typeof app === 'string' ? app : app.name || '';
          const subspaceInfo = (entry._subspace || []).filter(m => m.appName === appStr);
          results.push({ appName: appStr, subspace: subspaceInfo, entryType: entry.matchedClass ? 'matched' : 'unknown' });
        }
      }
    }
  };
  search(appspace.entries);
  search(appspace.interactions);
  search(appspace.unknown);
  return results;
}
