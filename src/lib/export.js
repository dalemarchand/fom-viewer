export function exportJSON(state) {
  const data = {
    files: state.files.map(f => ({
      name: f.name,
      version: f.version,
      dependencies: f.dependencies,
      objectClasses: f.objectClasses?.length || 0,
      interactionClasses: f.interactionClasses?.length || 0,
      dataTypes: {
        basic: f.dataTypes?.basic?.length || 0,
        simple: f.dataTypes?.simple?.length || 0,
        array: f.dataTypes?.array?.length || 0,
        fixed: f.dataTypes?.fixed?.length || 0,
        enum: f.dataTypes?.enum?.length || 0,
        variant: f.dataTypes?.variant?.length || 0
      }
    })),
    merged: state.mergedFOM ? {
      objectClasses: state.mergedFOM.objectClasses?.map(c => ({ name: c.name, sharing: c.sharing, semantics: c.semantics, parent: c.parent, attributeCount: c.attributes?.length || 0 })),
      interactionClasses: state.mergedFOM.interactionClasses?.map(c => ({ name: c.name, sharing: c.sharing, semantics: c.semantics, parent: c.parent, parameterCount: c.parameters?.length || 0 })),
      dimensions: state.mergedFOM.dimensions?.map(d => ({ name: d.name, dataType: d.dataType, dimensions: d.dimensions, units: d.units })),
      transportations: state.mergedFOM.transportations?.map(t => ({ name: t.name, reliable: t.reliable, semantics: t.semantics })),
      switches: state.mergedFOM.switches?.map(s => ({ name: s.name, dataType: s.dataType, semantics: s.semantics })),
      tags: state.mergedFOM.tags?.map(t => ({ name: t.name, dataType: t.dataType })),
      notes: state.mergedFOM.notes?.map(n => ({ name: n.name, text: n.text })),
      time: state.mergedFOM.time || null
    } : null
  };
  downloadJSON(data, 'fom-export.json');
}

export function exportFullJSON(state) {
  const data = {
    generatedAt: new Date().toISOString(),
    files: state.files,
    merged: state.mergedFOM
  };
  downloadJSON(data, 'fom-full-export.json');
}

export function exportCSV(state, tab, subTab) {
  const merged = state.mergedFOM;
  if (!merged) return;
  let rows = [];
  let headers = [];

  if (tab === 'objects' || tab === 'object') {
    headers = ['Name', 'Parent', 'Sharing', 'Semantics', 'Attributes', 'Modules'];
    merged.objectClasses?.forEach(c => {
      rows.push([c.name, c.parent || '', c.sharing || '', (c.semantics || '').replace(/"/g, '""'), String(c.attributes?.length || 0), (c._sources || []).join('; ')]);
    });
  } else if (tab === 'interactions' || tab === 'interaction') {
    headers = ['Name', 'Parent', 'Sharing', 'Semantics', 'Parameters', 'Modules'];
    merged.interactionClasses?.forEach(c => {
      rows.push([c.name, c.parent || '', c.sharing || '', (c.semantics || '').replace(/"/g, '""'), String(c.parameters?.length || 0), (c._sources || []).join('; ')]);
    });
  } else if (tab === 'datatypes' && subTab) {
    headers = ['Name', 'Type', ...(subTab === 'fixed' ? ['Fields'] : subTab === 'enum' ? ['Values'] : subTab === 'variant' ? ['Alternatives'] : ['Details'])];
    const dt = merged.dataTypes?.[subTab];
    dt?.forEach(item => {
      const detail = subTab === 'fixed' ? String(item.fields?.length || 0) :
        subTab === 'enum' ? String(item.values?.length || 0) :
        subTab === 'variant' ? String(item.alternatives?.length || 0) :
        item.representation || item.encoding || '';
      rows.push([item.name, subTab, detail]);
    });
  } else if (tab === 'dims') {
    headers = ['Name', 'Data Type', 'Dimensions', 'Units'];
    merged.dimensions?.forEach(d => rows.push([d.name, d.dataType || '', d.dimensions || '', d.units || '']));
  } else if (tab === 'trans') {
    headers = ['Name', 'Reliable', 'Semantics'];
    merged.transportations?.forEach(t => rows.push([t.name, t.reliable || '', (t.semantics || '').replace(/"/g, '""')]));
  } else {
    headers = ['Name', 'Type'];
    Object.entries(merged).forEach(([key, items]) => {
      if (Array.isArray(items)) items.forEach(item => rows.push([item.name, key]));
    });
  }

  if (rows.length === 0) return;
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  downloadBlob(csv, 'fom-export.csv', 'text/csv');
}

export function exportPrint() {
  window.print();
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename, 'application/json');
}

function downloadBlob(content, filename, mimeType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
