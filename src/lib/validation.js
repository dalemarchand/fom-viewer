function getSourceVariantAlternatives(item, source, files) {
  const file = files.find(f => f.name === source);
  if (!file) return item.alternatives || [];
  const variantType = file.dataTypes.variant?.find(v => v.name === item.name);
  return variantType?.alternatives || [];
}

function areVariantAlternativesEqual(alt1, alt2) {
  if (!alt1 && !alt2) return true;
  if (!alt1 || !alt2) return false;
  if (alt1.length !== alt2.length) return false;
  const sorted1 = [...alt1].sort((a, b) => a.label.localeCompare(b.label));
  const sorted2 = [...alt2].sort((a, b) => a.label.localeCompare(b.label));
  return sorted1.every((a1, i) => a1.label === sorted2[i].label && a1.dataType === sorted2[i].dataType);
}

function checkConflicts(state, makeIssue) {
  const files = state.files;
  if (!files || files.length < 2) return;
  const merged = state.mergedFOM;
  if (!merged) return;

  const fixedRecords = merged.dataTypes?.fixed || [];
  fixedRecords.forEach(record => {
    const sources = record._sources;
    if (!sources || sources.length < 2) return;
    const counts = sources.map(s => {
      const file = files.find(f => f.name === s);
      const src = file?.dataTypes?.fixed?.find(r => r.name === record.name);
      return src?.fields?.length || 0;
    });
    if (new Set(counts).size > 1) {
      state.issues.push(makeIssue('warning', 'load-conflict', 'fixed-record-fields',
        `Fixed record "${record.name}" has different field counts across modules`,
        counts.map((c, i) => `${sources[i]}: ${c} fields`).join('; '),
        [...sources],
        [{ tab: 'datatypes', subTab: 'fixed', itemName: record.name }]
      ));
    }
  });

  const enumTypes = merged.dataTypes?.enum || [];
  enumTypes.forEach(enumType => {
    const sources = enumType._sources;
    if (!sources || sources.length < 2) return;
    const valueMap = {};
    (enumType.values || []).forEach(v => {
      if (!valueMap[v.value]) valueMap[v.value] = [];
      valueMap[v.value].push(v.name);
    });
    const hasConflict = Object.values(valueMap).some(names => new Set(names).size > 1);
    if (hasConflict) {
      state.issues.push(makeIssue('warning', 'load-conflict', 'enum-values',
        `Enum "${enumType.name}" has same numeric value with different names across modules`,
        '',
        [...sources],
        [{ tab: 'datatypes', subTab: 'enum', itemName: enumType.name }]
      ));
    }
  });

  const variantTypes = merged.dataTypes?.variant || [];
  variantTypes.forEach(variantType => {
    const sources = variantType._sources;
    if (!sources || sources.length < 2) return;
    let hasConflict = false;
    for (let i = 0; i < sources.length && !hasConflict; i++) {
      for (let j = i + 1; j < sources.length && !hasConflict; j++) {
        const alt1 = getSourceVariantAlternatives(variantType, sources[i], files);
        const alt2 = getSourceVariantAlternatives(variantType, sources[j], files);
        if (!areVariantAlternativesEqual(alt1, alt2)) hasConflict = true;
      }
    }
    if (hasConflict) {
      state.issues.push(makeIssue('warning', 'load-conflict', 'variant-alternatives',
        `Variant record "${variantType.name}" has different alternatives across modules`,
        '',
        [...sources],
        [{ tab: 'datatypes', subTab: 'variant', itemName: variantType.name }]
      ));
    }
  });

  const objectClasses = merged.objectClasses || [];
  objectClasses.forEach(cls => {
    const sources = cls._sources;
    if (!sources || sources.length < 2) return;
    const counts = sources.map(s => {
      const file = files.find(f => f.name === s);
      const src = file?.objectClasses?.find(c => c.name === cls.name);
      return src?.attributes?.length || 0;
    });
    const nonZeroCounts = counts.filter(c => c > 0);
    if (nonZeroCounts.length >= 2 && new Set(nonZeroCounts).size > 1) {
      const perSourceDetails = sources.map((s, i) => {
        const file = files.find(f => f.name === s);
        const src = file?.objectClasses?.find(c => c.name === cls.name);
        const attrNames = src?.attributes?.map(a => a.name) || [];
        const visibleText = `${s}: ${counts[i]} attributes`;
        const tooltipText = attrNames.length > 0 ? attrNames.join(', ') : '';
        return tooltipText ? `${visibleText}||${tooltipText}` : visibleText;
      }).join('; ');
      state.issues.push(makeIssue('warning', 'load-conflict', 'object-attributes',
        `Object class "${cls.name}" has different attribute counts across modules`,
        perSourceDetails,
        [...sources],
        [{ tab: 'objects', subTab: '', itemName: cls.name }]
      ));
    }
  });

  const interactionClasses = merged.interactionClasses || [];
  interactionClasses.forEach(cls => {
    const sources = cls._sources;
    if (!sources || sources.length < 2) return;
    const counts = sources.map(s => {
      const file = files.find(f => f.name === s);
      const src = file?.interactionClasses?.find(c => c.name === cls.name);
      return src?.parameters?.length || 0;
    });
    const nonZeroCounts = counts.filter(c => c > 0);
    if (nonZeroCounts.length >= 2 && new Set(nonZeroCounts).size > 1) {
      const perSourceDetails = sources.map((s, i) => {
        const file = files.find(f => f.name === s);
        const src = file?.interactionClasses?.find(c => c.name === cls.name);
        const paramNames = src?.parameters?.map(p => p.name) || [];
        const visibleText = `${s}: ${counts[i]} parameters`;
        const tooltipText = paramNames.length > 0 ? paramNames.join(', ') : '';
        return tooltipText ? `${visibleText}||${tooltipText}` : visibleText;
      }).join('; ');
      state.issues.push(makeIssue('warning', 'load-conflict', 'interaction-parameters',
        `Interaction class "${cls.name}" has different parameter counts across modules`,
        perSourceDetails,
        [...sources],
        [{ tab: 'interactions', subTab: '', itemName: cls.name }]
      ));
    }
  });

  const transportations = merged.transportations || [];
  transportations.forEach(t => {
    const sources = t._sources;
    if (!sources || sources.length < 2) return;
    const seenSemantics = new Set();
    const seenReliable = new Set();
    sources.forEach(s => {
      const file = files.find(f => f.name === s);
      const src = file?.transportations?.find(tr => tr.name === t.name);
      if (src?.semantics) seenSemantics.add(src.semantics);
      if (src?.reliable) seenReliable.add(src.reliable);
    });
    if (seenSemantics.size > 1 || seenReliable.size > 1) {
      state.issues.push(makeIssue('warning', 'load-conflict', 'transportation',
        `Transportation "${t.name}" has conflicting semantics or reliable values across modules`,
        sources.map(s => {
          const file = files.find(f => f.name === s);
          const src = file?.transportations?.find(tr => tr.name === t.name);
          return `${s}: reliable=${src?.reliable || ''} semantics=${src?.semantics || ''}`;
        }).join('; '),
        [...sources],
        [{ tab: 'trans', subTab: '', itemName: t.name }]
      ));
    }
  });

  const switches = merged.switches || [];
  switches.forEach(sw => {
    const sources = sw._sources;
    if (!sources || sources.length < 2) return;
    const seenValues = new Set();
    sources.forEach(s => {
      const file = files.find(f => f.name === s);
      const src = file?.switches?.find(s2 => s2.name === sw.name);
      if (src?.value) seenValues.add(src.value);
    });
    if (seenValues.size > 1) {
      state.issues.push(makeIssue('warning', 'load-conflict', 'switch',
        `Switch "${sw.name}" has different values across modules`,
        sources.map(s => {
          const file = files.find(f => f.name === s);
          const src = file?.switches?.find(s2 => s2.name === sw.name);
          return `${s}: ${src?.value || '(empty)'}`;
        }).join('; '),
        [...sources],
        [{ tab: 'switches', subTab: '', itemName: sw.name }]
      ));
    }
  });

  if (files.length >= 2) {
    const uniqueTimestamps = new Set();
    const uniqueLookaheads = new Set();
    files.forEach(f => {
      if (f.time?.timeStamp?.dataType) uniqueTimestamps.add(f.time.timeStamp.dataType);
      if (f.time?.lookahead?.dataType) uniqueLookaheads.add(f.time.lookahead.dataType);
    });
    if (uniqueTimestamps.size > 1) {
      state.issues.push(makeIssue('warning', 'load-conflict', 'time',
        'Timestamp data type differs across modules',
        files.map(f => `${f.name}: ${f.time?.timeStamp?.dataType || '(none)'}`).join('; '),
        files.map(f => f.name),
        [{ tab: 'time', subTab: '', itemName: '' }]
      ));
    }
    if (uniqueLookaheads.size > 1) {
      state.issues.push(makeIssue('warning', 'load-conflict', 'time',
        'Lookahead data type differs across modules',
        files.map(f => `${f.name}: ${f.time?.lookahead?.dataType || '(none)'}`).join('; '),
        files.map(f => f.name),
        [{ tab: 'time', subTab: '', itemName: '' }]
      ));
    }
  }
}

function checkCrossReferences(files, merged, state, makeIssue) {
  if (!merged) return;

  const dimNames = new Set();
  (files || []).forEach(f => (f.dimensions || []).forEach(d => dimNames.add((d.name || d).trim())));
  const transNames = new Set((merged.transportations || []).map(t => t.name.trim()));
  const dataTypeNames = new Set();
  ['basic', 'simple', 'array', 'fixed', 'enum', 'variant'].forEach(cat => {
    (merged.dataTypes?.[cat] || []).forEach(dt => dataTypeNames.add(dt.name));
  });
  const hlaBuiltins = ['HLAinteger32BE','HLAinteger32LE','HLAinteger64BE','HLAinteger64LE',
    'HLAinteger16BE','HLAinteger16LE','HLAoctet','HLAoctetPairBE','HLAoctetPairLE',
    'HLAfloat32BE','HLAfloat32LE','HLAfloat64BE','HLAfloat64LE',
    'HLAunicodeString','HLAASCIIstring','HLAboolean','HLAbyte',
    'HLAvariableArrayData','HLAfixedArrayData','HLAfixedRecordData','HLAvariantRecordData',
    'HLAopaqueData','HLAunicodeChar','HLAASCIIchar','HLAintegerSize','HLAinteger'];
  hlaBuiltins.forEach(t => dataTypeNames.add(t));
  ['HLAreliable', 'HLAbestEffort'].forEach(t => transNames.add(t));
  const loadedFileNames = new Set((files || []).map(f => f.name));

  (merged.interactionClasses || []).forEach(int => {
    const intSources = int._sources || (int._source ? [int._source] : []);
    (int.dimensions || []).forEach(dim => {
      if (!dimNames.has(dim.trim())) {
        state.issues.push(makeIssue('warning', 'cross-reference', 'missing-dimension',
          `Interaction "${int.name}" references unknown dimension "${dim}"`,
          `The dimension "${dim}" is not defined in any loaded FOM module.`,
          intSources,
          [{ tab: 'interactions', itemName: int.name }]
        ));
      }
    });
    if (int.transportation && !transNames.has(int.transportation.trim())) {
      state.issues.push(makeIssue('warning', 'cross-reference', 'missing-transportation',
        `Interaction "${int.name}" references unknown transportation "${int.transportation}"`,
        `The transportation "${int.transportation}" is not defined in any loaded FOM module.`,
        intSources,
        [{ tab: 'interactions', itemName: int.name }]
      ));
    }
    (int.parameters || []).forEach(param => {
      if (param.dataType && !dataTypeNames.has(param.dataType)) {
        state.issues.push(makeIssue('warning', 'cross-reference', 'missing-data-type',
          `Parameter "${param.name}" of interaction "${int.name}" references unknown data type "${param.dataType}"`,
          `The data type "${param.dataType}" is not defined in any loaded FOM module.`,
          intSources,
          [{ tab: 'interactions', itemName: int.name }]
        ));
      }
    });
  });

  (merged.objectClasses || []).forEach(obj => {
    const objSources = obj._sources || (obj._source ? [obj._source] : []);
    (obj.attributes || []).forEach(attr => {
      (attr.dimensions || []).forEach(dim => {
        if (!dimNames.has(dim.trim())) {
          state.issues.push(makeIssue('warning', 'cross-reference', 'missing-dimension',
            `Attribute "${attr.name}" of object "${obj.name}" references unknown dimension "${dim}"`,
            `The dimension "${dim}" is not defined in any loaded FOM module.`,
            objSources,
            [{ tab: 'objects', itemName: obj.name }]
          ));
        }
      });
      if (attr.transportation && !transNames.has(attr.transportation.trim())) {
        state.issues.push(makeIssue('warning', 'cross-reference', 'missing-transportation',
          `Attribute "${attr.name}" of object "${obj.name}" references unknown transportation "${attr.transportation}"`,
          `The transportation "${attr.transportation}" is not defined in any loaded FOM module.`,
          objSources,
          [{ tab: 'objects', itemName: obj.name }]
        ));
      }
      if (attr.dataType && !dataTypeNames.has(attr.dataType)) {
        state.issues.push(makeIssue('warning', 'cross-reference', 'missing-data-type',
          `Attribute "${attr.name}" of object "${obj.name}" references unknown data type "${attr.dataType}"`,
          `The data type "${attr.dataType}" is not defined in any loaded FOM module.`,
          objSources,
          [{ tab: 'objects', itemName: obj.name }]
        ));
      }
    });
  });

  (files || []).forEach(f => {
    (f.dimensions || []).forEach(dim => {
      const dimName = dim.name || dim;
      if (dim.rows && dim.rows.length > 0) {
        dim.rows.forEach(row => {
          if (row.key === 'dataType' && row.value && !dataTypeNames.has(row.value)) {
            state.issues.push(makeIssue('warning', 'cross-reference', 'missing-data-type',
              `Dimension "${dimName}" references unknown data type "${row.value}"`,
              `The data type "${row.value}" is not defined in any loaded FOM module.`,
              [f.name],
              [{ tab: 'dims', itemName: dimName }]
            ));
          }
        });
      }
    });
  });

  (files || []).forEach(file => {
    (file.dependencies || []).forEach(dep => {
      if (!loadedFileNames.has(dep)) {
        state.issues.push(makeIssue('warning', 'cross-reference', 'missing-dependency',
          `Module "${file.name}" depends on missing module "${dep}"`,
          `The module "${dep}" is required by "${file.name}" but is not loaded.`,
          [file.name],
          []
        ));
      }
    });
  });

  (merged.dataTypes?.variant || []).forEach(vt => {
    const vtSources = vt._sources || (vt._source ? [vt._source] : []);
    const enumType = (merged.dataTypes?.enum || []).find(e => e.name === vt.dataType);
    if (vt.dataType && !enumType) {
      state.issues.push(makeIssue('error', 'validation', 'missing-discriminant-type',
        `Variant record "${vt.name}" references unknown discriminant type "${vt.dataType}"`,
        `The type "${vt.dataType}" is not defined as an enumerated data type.`,
        vtSources,
        [{ tab: 'datatypes', subTab: 'variant', itemName: vt.name }]
      ));
    }
    (vt.alternatives || []).forEach(a => {
      (a.enumerators || []).forEach(en => {
        if (en && enumType && !enumType.values.some(v => v.name === en)) {
          state.issues.push(makeIssue('error', 'validation', 'missing-enumerator',
            `Alternative "${a.label}" of variant record "${vt.name}" references unknown enumerator "${en}"`,
            `The enumerator "${en}" is not defined in enum "${vt.dataType}".`,
            vtSources,
            [{ tab: 'datatypes', subTab: 'variant', itemName: vt.name }]
          ));
        }
      });
    });
  });
}

export function detectCircularDependencies(state, makeIssue) {
  if (!state.issues) state.issues = [];
  const files = state.files;
  if (!files || files.length < 2) return;

  const fileNames = new Set(files.map(f => f.name));

  const graph = {};
  files.forEach(f => { graph[f.name] = []; });
  files.forEach(f => {
    (f.dependencies || []).forEach(dep => {
      if (fileNames.has(dep)) {
        graph[dep].push(f.name);
      }
    });
  });

  const index = {};
  const lowlink = {};
  const onStack = {};
  const stack = [];
  let nextIndex = 0;
  const sccs = [];

  function strongconnect(v) {
    index[v] = nextIndex;
    lowlink[v] = nextIndex;
    nextIndex++;
    stack.push(v);
    onStack[v] = true;

    (graph[v] || []).forEach(w => {
      if (index[w] === undefined) {
        strongconnect(w);
        lowlink[v] = Math.min(lowlink[v], lowlink[w]);
      } else if (onStack[w]) {
        lowlink[v] = Math.min(lowlink[v], index[w]);
      }
    });

    if (lowlink[v] === index[v]) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack[w] = false;
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  files.forEach(f => {
    if (index[f.name] === undefined) strongconnect(f.name);
  });

  sccs.forEach(scc => {
    if (scc.length > 1) {
      state.issues.push(makeIssue('error', 'circular-dependency', 'cycle-detected',
        'Circular dependency detected among modules',
        `Modules involved in cycle: ${scc.sort().join(', ')}`,
        [...scc],
        []
      ));
    } else {
      const node = scc[0];
      if ((graph[node] || []).includes(node)) {
        state.issues.push(makeIssue('error', 'circular-dependency', 'cycle-detected',
          'Circular dependency detected among modules',
          `Module has a self-referencing dependency: ${node}`,
          [node],
          []
        ));
      }
    }
  });
}

export function validate(state, makeIssue) {
  state.issues = [];
  checkConflicts(state, makeIssue);
  checkCrossReferences(state.files, state.mergedFOM, state, makeIssue);
  detectCircularDependencies(state, makeIssue);
}

export function updateIssuesTabVisibility(state) {
  const tab = document.querySelector('.tab[data-tab="issues"]');
  if (!tab) return;
  tab.style.display = state.issues.length > 0 ? '' : 'none';
}
