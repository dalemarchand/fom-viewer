// Helper utility functions for parsing and classifying HLA appspace mapping files.

export function findClassByRightSideMatch(entryName, classList) {
  let bestMatch = null;
  let bestLength = 0;

  classList.forEach(cls => {
    const entryParts = entryName.split('.');
    const classParts = cls.name.split('.');

    // Check if entry matches the right side of className (case-sensitive)
    if (classParts.length >= entryParts.length) {
      const startIdx = classParts.length - entryParts.length;
      let matches = true;
      for (let i = 0; i < entryParts.length; i++) {
        if (classParts[startIdx + i] !== entryParts[i]) {
          matches = false;
          break;
        }
      }
      if (matches && entryParts.length > bestLength) {
        bestMatch = cls;
        bestLength = entryParts.length;
      }
    }
  });

  return bestMatch;
}

export function parseAppspaceFile(content) {
  if (!content) return [];
  const lines = content.split('\n');
  const entries = [];
  
  lines.forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    // Skip CSV header line if present
    const lower = line.toLowerCase();
    if (lower.startsWith('class,') || lower.startsWith('classname,') || lower.startsWith('class|') || lower.startsWith('classname|')) {
      return;
    }
    
    let className = '';
    let apps = [];
    
    if (line.includes('|')) {
      const parts = line.split('|');
      if (parts.length === 2) {
        className = parts[0].trim();
        apps = parts[1].split(',').map(a => a.trim()).filter(a => a);
      }
    } else if (line.includes(',')) {
      const firstCommaIdx = line.indexOf(',');
      if (firstCommaIdx > 0) {
        className = line.substring(0, firstCommaIdx).trim();
        const appsStr = line.substring(firstCommaIdx + 1).trim();
        apps = appsStr.split(/[;,]/).map(a => a.trim().replace(/^["']|["']$/g, '')).filter(a => a);
      }
    }
    
    if (className && apps.length > 0) {
      entries.push({ className, apps });
    }
  });
  
  return entries;
}

export function classifyAppspaceEntries(entries, objectClasses, interactionClasses) {
  const objects = [];
  const interactions = [];
  const unknown = [];
  
  entries.forEach(entry => {
    let matched = false;
    
    // Check object classes
    const objectMatch = findClassByRightSideMatch(entry.className, objectClasses);
    if (objectMatch) {
      objects.push({ ...entry, matchedClass: objectMatch.name });
      matched = true;
    }
    
    // Check interaction classes
    const interactionMatch = findClassByRightSideMatch(entry.className, interactionClasses);
    if (interactionMatch) {
      interactions.push({ ...entry, matchedClass: interactionMatch.name });
      matched = true;
    }
    
    // No match found
    if (!matched) {
      unknown.push({ ...entry });
    }
  });
  
  return { objects, interactions, unknown };
}
