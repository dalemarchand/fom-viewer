export function topologicalSort(files) {
  const graph = {};
  const inDegree = {};
  files.forEach(f => { graph[f.name] = []; inDegree[f.name] = 0; });
  files.forEach(f => { f.dependencies.forEach(dep => { if (graph[dep] !== undefined) { graph[dep].push(f.name); inDegree[f.name]++; } }); });
  const queue = files.filter(f => inDegree[f.name] === 0).map(f => f.name);
  const result = [];
  while (queue.length > 0) {
    const current = queue.shift();
    const file = files.find(f => f.name === current);
    if (file) result.push(file);
    graph[current].forEach(neighbor => { inDegree[neighbor]--; if (inDegree[neighbor] === 0) queue.push(neighbor); });
  }
  return result;
}

export function mergeClasses(files, type) {
  const map = {};
  files.forEach(file => {
    const classes = type === 'object' ? file.objectClasses : file.interactionClasses;
    classes.forEach(c => {
      if (!map[c.name]) {
        const mergedAttrs = c.attributes ? c.attributes.map(a => ({ ...a, _source: file.name })) : undefined;
        const mergedParams = c.parameters ? c.parameters.map(p => ({ ...p, _source: file.name })) : undefined;
        map[c.name] = {
          ...c,
          attributes: mergedAttrs,
          parameters: mergedParams,
          _sources: [file.name]
        };
      }
      else {
        map[c.name]._sources.push(file.name);
        if (c.attributes) {
          const existingAttrs = map[c.name].attributes || [];
          const existingNames = new Set(existingAttrs.map(a => a.name));
          c.attributes.forEach(attr => {
            if (!existingNames.has(attr.name)) {
              existingAttrs.push({ ...attr, _source: file.name });
              existingNames.add(attr.name);
            }
          });
          map[c.name].attributes = existingAttrs;
        }
        if (c.parameters) {
          const existingParams = map[c.name].parameters || [];
          const existingNames = new Set(existingParams.map(p => p.name));
          c.parameters.forEach(param => {
            if (!existingNames.has(param.name)) {
              existingParams.push({ ...param, _source: file.name });
              existingNames.add(param.name);
            }
          });
          map[c.name].parameters = existingParams;
        }
      }
    });
  });
  return Object.values(map);
}

export function mergeTransportations(files) {
  const map = {};
  const warnings = [];
  files.forEach(f => {
    const transList = f.transportations || [];
    transList.forEach(t => {
      if (!map[t.name]) {
        map[t.name] = { ...t, _sources: [f.name] };
      } else {
        map[t.name]._sources.push(f.name);
        if (map[t.name].reliable !== t.reliable && t.reliable) {
          warnings.push(`Transportation "${t.name}" has conflicting reliable values`);
        }
        if (!map[t.name].semantics && t.semantics) {
          map[t.name].semantics = t.semantics;
        } else if (map[t.name].semantics !== t.semantics && t.semantics) {
          warnings.push(`Transportation "${t.name}" has conflicting semantics`);
        }
        if (t.rows && t.rows.length > 0) {
          if (!map[t.name].rows) map[t.name].rows = [];
          t.rows.forEach(r => {
            if (!map[t.name].rows.some(er => er.key === r.key && er.value === r.value)) {
              map[t.name].rows.push(r);
            }
          });
        }
      }
    });
  });
  return Object.values(map);
}

export function mergeArrayProperty(existing, incoming, type) {
  const propName = type === 'fixed' ? 'fields' : type === 'enum' ? 'values' : 'alternatives';
  const existingArr = existing[propName] || [];
  const incomingArr = incoming[propName] || [];
  return [...existingArr, ...incomingArr];
}

export function getSourceVariantAlternatives(item, source, files) {
  const file = files.find(f => f.name === source);
  if (!file) return item.alternatives || [];
  const variantType = file.dataTypes.variant?.find(v => v.name === item.name);
  return variantType?.alternatives || [];
}

export function areVariantAlternativesEqual(alt1, alt2) {
  if (!alt1 && !alt2) return true;
  if (!alt1 || !alt2) return false;
  if (alt1.length !== alt2.length) return false;
  const sorted1 = [...alt1].sort((a, b) => a.label.localeCompare(b.label));
  const sorted2 = [...alt2].sort((a, b) => a.label.localeCompare(b.label));
  return sorted1.every((a1, i) => a1.label === sorted2[i].label && a1.dataType === sorted2[i].dataType);
}

export function checkConflicts(items, type, files, conflicts) {
  items.forEach(item => {
    if (item._sources && item._sources.length > 1) {
      if (type === 'enum') {
        const values = item.values || [];
        const valueMap = {};
        values.forEach(v => {
          if (!valueMap[v.value]) valueMap[v.value] = [];
          valueMap[v.value].push(v.name);
        });
        let hasConflict = false;
        Object.keys(valueMap).forEach(val => {
          const names = valueMap[val];
          if (names.length > 1) {
            const uniqueNames = [...new Set(names)];
            if (uniqueNames.length > 1) hasConflict = true;
          }
        });
        if (hasConflict) {
          conflicts.push({ name: item.name, type, sources: item._sources, reason: 'Enumerators with same value have different names' });
        }
      } else if (type === 'variant') {
        const hasConflict = item._sources.some(source1 => {
          const alt1 = getSourceVariantAlternatives(item, source1, files);
          return item._sources.some(source2 => {
            if (source1 === source2) return false;
            const alt2 = getSourceVariantAlternatives(item, source2, files);
            return !areVariantAlternativesEqual(alt1, alt2);
          });
        });
        if (hasConflict) {
          conflicts.push({ name: item.name, type, sources: item._sources, reason: 'Alternatives differ across modules' });
        }
      }
    }
  });
}

export function mergeDataTypes(files) {
  const result = { basic: [], simple: [], array: [], fixed: [], enum: [], variant: [] };
  const conflicts = [];
  const typeMap = { basic: 'basic', simple: 'simple', array: 'array', fixed: 'fixed', enum: 'enum', variant: 'variant' };
  Object.keys(typeMap).forEach(type => {
    const map = {};
    const addToMap = (items) => {
      items.forEach(item => {
        if (!map[item.name]) { map[item.name] = { ...item, _sources: [item._source] }; }
        else { map[item.name]._sources.push(item._source); if (type === 'fixed' || type === 'enum' || type === 'variant') map[item.name][type === 'enum' ? 'values' : type === 'variant' ? 'alternatives' : 'fields'] = mergeArrayProperty(map[item.name], item, type); }
      });
    };
    files.forEach(f => addToMap(f.dataTypes[typeMap[type]] || []));
    const values = Object.values(map);
    if (type === 'enum' || type === 'variant') { checkConflicts(values, type, files, conflicts); }
    result[type] = values;
  });
  return { result, conflicts };
}

export function mergeSwitches(files) {
  const map = {};
  files.forEach(f => {
    (f.switches || []).forEach(sw => {
      if (!map[sw.name]) {
        map[sw.name] = { ...sw, _sources: [f.name] };
      } else {
        map[sw.name]._sources.push(f.name);
      }
    });
  });
  return Object.values(map);
}

export function mergeTags(files) {
  const map = {};
  files.forEach(f => {
    (f.tags || []).forEach(t => {
      if (!map[t.name]) {
        map[t.name] = { ...t, _sources: [f.name] };
      } else {
        map[t.name]._sources.push(f.name);
      }
    });
  });
  return Object.values(map);
}

export function mergeTime(files) {
  const result = {};
  files.forEach(f => {
    if (f.time) {
      if (f.time.timeStamp && !result.timeStamp) result.timeStamp = f.time.timeStamp;
      if (f.time.lookahead && !result.lookahead) result.lookahead = f.time.lookahead;
    }
  });
  return result;
}
