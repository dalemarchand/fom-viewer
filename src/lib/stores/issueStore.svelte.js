let issues = $state([]);
let issuesFilter = $state('all');
let selectedIssueId = $state('');

export function getIssues() {
  return issues;
}

export function setIssues(newIssues) {
  issues = newIssues;
}

export function addIssue(issue) {
  issues = [...issues, issue];
}

export function clearIssues() {
  issues = [];
}

export function getIssuesFilter() {
  return issuesFilter;
}

export function setIssuesFilter(filter) {
  issuesFilter = filter;
}

export function getSelectedIssueId() {
  return selectedIssueId;
}

export function selectIssue(issueId) {
  selectedIssueId = issueId;
}

export function resetIssues() {
  issues = [];
  issuesFilter = 'all';
  selectedIssueId = '';
}

export function getFilteredIssues() {
  if (issuesFilter === 'error') {
    return issues.filter(i => i.severity === 'error');
  }
  if (issuesFilter === 'warning') {
    return issues.filter(i => i.severity === 'warning');
  }
  return issues;
}

export function getFilteredCount() {
  if (issuesFilter === 'error') {
    return issues.filter(i => i.severity === 'error').length;
  }
  if (issuesFilter === 'warning') {
    return issues.filter(i => i.severity === 'warning').length;
  }
  return issues.length;
}

function typeToTab(type) {
  const typeMap = { object: 'objects', interaction: 'interactions' };
  const dataTypes = ['basic', 'simple', 'array', 'fixed', 'enum', 'variant'];
  if (dataTypes.includes(type)) return 'datatypes';
  return typeMap[type] || type;
}

export function findIssuesForItem(itemName, type) {
  if (!issues || issues.length === 0) return [];
  const tab = typeToTab(type);
  return issues.filter(issue => {
    if (!issue || typeof issue !== 'object' || !issue.locations || issue.locations.length === 0) return false;
    return issue.locations.some(loc => loc.itemName === itemName && loc.tab === tab);
  });
}
