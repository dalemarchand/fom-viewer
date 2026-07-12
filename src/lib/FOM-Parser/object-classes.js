import { buildFullName, getSource } from './core.js';

export function parseObjectClasses(doc) {
  const classes = [];
  const elements = doc.querySelectorAll('objectClass, objectClassRTI');
  elements.forEach(el => {
    const name = el.querySelector('name')?.textContent || '';
    if (!name) return;
    const fullName = buildFullName(el, ['objectClass', 'objectClassRTI']);
    const parentEl = el.parentElement;
    const fullParentName = (parentEl && (parentEl.tagName === 'objectClass' || parentEl.tagName === 'objectClassRTI')) ? buildFullName(parentEl, ['objectClass', 'objectClassRTI']) : '';
    const sharing = el.querySelector('sharing')?.textContent || '';
    const semantics = el.querySelector('semantics')?.textContent || '';
    const classNotes = el.getAttribute('notes') || '';
    const attributes = [];
    const childNodes = el.childNodes;
    childNodes.forEach(node => {
      if (node.nodeName === 'attribute' || node.nodeName === 'attributeRTI') {
        const attrName = node.querySelector('name')?.textContent || '';
        const attrSharing = node.querySelector('sharing')?.textContent || '';
        const attrSemantics = node.querySelector('semantics')?.textContent || '';
        const attrNotes = node.getAttribute('notes') || '';
        const dt = node.querySelector('dataType')?.textContent || '';
        const updateType = node.querySelector('updateType')?.textContent || '';
        const ucEl = node.querySelector('updateCondition');
        const updateCondition = ucEl?.textContent || '';
        const updateConditionNotes = ucEl?.getAttribute('notes') || '';
        const ownership = node.querySelector('ownership')?.textContent || '';
        const transportation = node.querySelector('transportation')?.textContent || '';
        const order = node.querySelector('order')?.textContent || '';
        const dimensionEls = node.querySelectorAll('dimensions > dimension');
        const dimensions = Array.from(dimensionEls).map(d => d.textContent.trim()).filter(d => d);
        if (attrName) attributes.push({ name: attrName, sharing: attrSharing, semantics: attrSemantics, notes: attrNotes, dataType: dt, updateType, updateCondition, updateConditionNotes, ownership, transportation, order, dimensions });
      }
    });
    classes.push({ name: fullName, sharing, semantics, notes: classNotes, attributes, parent: fullParentName, _source: getSource(doc) });
  });
  return classes;
}
