export function parseListElements(doc, selector) {
  const els = doc.querySelectorAll(selector);
  return Array.from(els).map(el => el.textContent?.trim()).filter(t => t);
}

export function parseDimensions(doc) {
  const result = [];
  const warnings = [];
  const root = doc.documentElement;
  if (!root) return { result, warnings };
  for (let i = 0; i < root.children.length; i++) {
    const el = root.children[i];
    if (el.tagName && el.tagName.includes('dimensions')) {
      const seen = {};
      for (let j = 0; j < el.children.length; j++) {
        const dim = el.children[j];
        if (dim.tagName && dim.tagName.includes('dimension')) {
          const nameEl = dim.querySelector('name');
          const name = nameEl ? nameEl.textContent?.trim() : dim.textContent?.trim() || '';
          if (name && !seen[name]) {
            seen[name] = true;
            const childEls = Array.from(dim.children).filter(c => c.nodeType === 1);
            if (childEls.length > 0) {
              const rows = [];
              childEls.forEach(child => {
                const tag = child.tagName ? child.tagName.split('}').pop() : null;
                const text = child.textContent?.trim();
                if (tag && text && tag !== 'name') rows.push({ key: tag, value: text });
              });
              result.push({ name, isComplex: true, rows });
            } else {
              result.push({ name, isComplex: false });
            }
          }
        }
      }
      break;
    }
  }
  const merged = [];
  const dimSeen = {};
  for (const d of result) {
    if (!dimSeen[d.name]) {
      dimSeen[d.name] = d;
      merged.push(d);
    } else {
      const existing = dimSeen[d.name];
      if (d.isComplex && d.rows && d.rows.length > 0) {
        if (!existing.rows) existing.rows = [];
        d.rows.forEach(r => {
          if (!existing.rows.some(er => er.key === r.key && er.value === r.value)) {
            existing.rows.push(r);
          }
        });
      }
    }
  }
  return { result: merged, warnings };
}

export function parseTransportations(doc) {
  const result = [];
  const warnings = [];
  const root = doc.documentElement;
  if (!root) return { result, warnings };
  for (let i = 0; i < root.children.length; i++) {
    const el = root.children[i];
    if (el.tagName && el.tagName.includes('transportations')) {
      for (let j = 0; j < el.children.length; j++) {
        const trans = el.children[j];
        if (trans.tagName && trans.tagName.includes('transportation')) {
          const nameEl = trans.querySelector('name');
          const name = nameEl ? nameEl.textContent?.trim() : trans.textContent?.trim() || '';
          const reliable = trans.querySelector('reliable')?.textContent?.trim() || '';
          const semanticsEl = trans.querySelector('semantics');
          const semantics = semanticsEl ? semanticsEl.textContent?.trim() : '';
          const rows = [];
          const childEls = Array.from(trans.children).filter(c => c.nodeType === 1);
          childEls.forEach(child => {
            const tag = child.tagName ? child.tagName.split('}').pop() : null;
            const text = child.textContent?.trim();
            if (tag && text && tag !== 'name' && tag !== 'reliable' && tag !== 'semantics') rows.push({ key: tag, value: text });
          });
          if (name) result.push({ name, reliable, semantics, rows: rows.length > 0 ? rows : null });
        }
      }
      break;
    }
  }
  const merged = [];
  const seen = {};
  for (const t of result) {
    if (!seen[t.name]) {
      seen[t.name] = t;
      merged.push(t);
    } else {
      const existing = seen[t.name];
      if (existing.reliable !== t.reliable) {
        warnings.push(`Transportation "${t.name}" has conflicting reliable values: "${existing.reliable}" vs "${t.reliable}"`);
      }
      if (existing.semantics !== t.semantics) {
        warnings.push(`Transportation "${t.name}" has conflicting semantics: "${existing.semantics}" vs "${t.semantics}"`);
      }
      if (t.rows && t.rows.length > 0) {
        if (!existing.rows) existing.rows = [];
        t.rows.forEach(r => {
          if (!existing.rows.some(er => er.key === r.key && er.value === r.value)) {
            existing.rows.push(r);
          }
        });
      }
    }
  }
  return { result: merged, warnings };
}

export function parseSwitches(doc) {
  const result = [];
  const root = doc.documentElement;
  if (!root) return result;
  for (let i = 0; i < root.children.length; i++) {
    const el = root.children[i];
    if (el.tagName && el.tagName.includes('switches')) {
      for (let j = 0; j < el.children.length; j++) {
        const sw = el.children[j];
        if (sw.tagName && sw.nodeType === 1) {
          const name = sw.tagName.split('}').pop() || sw.tagName;
          const isEnabled = sw.getAttribute('isEnabled');
          const value = sw.getAttribute('resignAction') || isEnabled || '';
          const semantics = sw.querySelector('semantics')?.textContent?.trim() || '';
          if (name) result.push({ name, value, semantics });
        }
      }
      break;
    }
  }
  return result;
}

export function parseTags(doc) {
  const result = [];
  const root = doc.documentElement;
  if (!root) return result;
  for (let i = 0; i < root.children.length; i++) {
    const el = root.children[i];
    if (el.tagName && el.tagName.includes('tags')) {
      for (let j = 0; j < el.children.length; j++) {
        const tag = el.children[j];
        if (tag.tagName && tag.nodeType === 1) {
          const name = tag.tagName.split('}').pop() || tag.tagName;
          const dataType = tag.querySelector('dataType')?.textContent?.trim() || '';
          const semantics = tag.querySelector('semantics')?.textContent?.trim() || '';
          if (name) result.push({ name, dataType, semantics });
        }
      }
      break;
    }
  }
  return result;
}

export function parseTime(doc) {
  const result = {};
  const root = doc.documentElement;
  if (!root) return result;
  for (let i = 0; i < root.children.length; i++) {
    const el = root.children[i];
    if (el.tagName && el.tagName.includes('time')) {
      const timeStamp = el.querySelector('timeStamp');
      if (timeStamp) {
        result.timeStamp = {
          dataType: timeStamp.querySelector('dataType')?.textContent?.trim() || '',
          semantics: timeStamp.querySelector('semantics')?.textContent?.trim() || ''
        };
      }
      const lookahead = el.querySelector('lookahead');
      if (lookahead) {
        result.lookahead = {
          dataType: lookahead.querySelector('dataType')?.textContent?.trim() || '',
          semantics: lookahead.querySelector('semantics')?.textContent?.trim() || ''
        };
      }
      break;
    }
  }
  return result;
}

export function parseNotes(doc) {
  const result = [];
  const root = doc.documentElement;
  if (!root) return result;
  for (let i = 0; i < root.children.length; i++) {
    const el = root.children[i];
    if (el.tagName && el.tagName.includes('notes')) {
      for (let j = 0; j < el.children.length; j++) {
        const note = el.children[j];
        if (note.tagName && note.tagName.includes('note')) {
          const label = note.querySelector('label')?.textContent?.trim() || '';
          const semantics = note.querySelector('semantics')?.textContent?.trim() || '';
          const rows = [];
          const childEls = Array.from(note.children).filter(c => c.nodeType === 1);
          childEls.forEach(child => {
            const tag = child.tagName ? child.tagName.split('}').pop() : null;
            const text = child.textContent?.trim();
            if (tag && text && tag !== 'label' && tag !== 'semantics') rows.push({ key: tag, value: text });
          });
          result.push({ name: label, semantics: semantics, rows: rows });
        }
      }
      break;
    }
  }
  return result;
}
