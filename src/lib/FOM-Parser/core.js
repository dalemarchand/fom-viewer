export function getSource(doc) {
  return doc.querySelector('modelIdentification > name')?.textContent || '';
}

export function buildFullName(el, validTagNames) {
  if (!el) return '';
  const name = el.querySelector('name')?.textContent || '';
  if (!name) return '';
  if (name === 'HLAobjectRoot' || name === 'HLAinteractionRoot') return name;
  const parentEl = el.parentElement;
  if (parentEl && validTagNames.includes(parentEl.tagName)) {
    const parentFullName = buildFullName(parentEl, validTagNames);
    return parentFullName + '.' + name;
  }
  return name;
}

export function parseModelIdentificationFull(modelIdent) {
  if (!modelIdent || typeof modelIdent === 'string' || !modelIdent.children) return [];
  const result = [];
  const seen = {};

  const children = Array.from(modelIdent.children).filter(c => c.nodeType === 1);
  for (const child of children) {
    const tag = child.tagName ? child.tagName.split('}').pop() : (child.tag || '').split('}').pop();
    if (!tag || seen[tag]) continue;

    const elems = modelIdent.querySelectorAll(tag);
    if (elems.length === 1) {
      const text = child.textContent?.trim();
      if (!text) continue;
      if (child.children && child.children.length > 0) {
        const subRows = [];
        const subChildren = Array.from(child.children).filter(c => c.nodeType === 1);
        for (const sub of subChildren) {
          const subTag = sub.tagName ? sub.tagName.split('}').pop() : (sub.tag || '').split('}').pop();
          const subText = sub.textContent?.trim();
          if (subText) subRows.push({ key: subTag, value: subText });
        }
        if (subRows.length > 0) result.push({ key: tag, value: '', isSubTable: true, rows: subRows });
      } else {
        result.push({ key: tag, value: text });
      }
    } else {
      const uniqueValues = new Set();
      elems.forEach(e => { const t = e.textContent?.trim(); if (t) uniqueValues.add(t); });
      const values = Array.from(uniqueValues);
      if (values.length > 0) {
        result.push({ key: tag, value: '', isList: true, values: values });
      }
    }
    seen[tag] = true;
  }
  return result;
}

export function parseDependencies(modelIdent) {
  const refs = modelIdent?.querySelectorAll('reference') || [];
  const deps = [];
  refs.forEach(ref => {
    const type = ref.querySelector('type')?.textContent;
    if (type === 'Dependency') {
      const name = ref.querySelector('identification')?.textContent || ref.querySelector('name')?.textContent;
      if (name) deps.push(name);
    }
  });
  return deps;
}
