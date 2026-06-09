import { buildFullName, getSource } from './core.js';

export function parseInteractionClasses(doc) {
  const classes = [];
  const elements = doc.querySelectorAll('interactionClass, interactionClassRTI');
  elements.forEach(el => {
    const name = el.querySelector('name')?.textContent || '';
    if (!name) return;
    const fullName = buildFullName(el, ['interactionClass', 'interactionClassRTI']);
    const parentEl = el.parentElement;
    const fullParentName = (parentEl && (parentEl.tagName === 'interactionClass' || parentEl.tagName === 'interactionClassRTI')) ? buildFullName(parentEl, ['interactionClass', 'interactionClassRTI']) : '';
    const sharing = el.querySelector('sharing')?.textContent || '';
    const semantics = el.querySelector('semantics')?.textContent || '';
    const classNotes = el.getAttribute('notes') || '';
    const dimensionEls = el.querySelectorAll('dimensions > dimension');
    const dimensions = Array.from(dimensionEls).map(d => d.textContent).filter(d => d);
    const transportation = el.querySelector('transportation')?.textContent || '';
    const order = el.querySelector('order')?.textContent || '';
    const parameters = [];
    const childNodes = el.childNodes;
    childNodes.forEach(node => {
      if (node.nodeName === 'parameter' || node.nodeName === 'parameterRTI') {
        const paramName = node.querySelector('name')?.textContent || '';
        const paramSharing = node.querySelector('sharing')?.textContent || '';
        const paramSemantics = node.querySelector('semantics')?.textContent || '';
        const paramNotes = node.getAttribute('notes') || '';
        const dt = node.querySelector('dataType')?.textContent || '';
        const order = node.querySelector('order')?.textContent || '';
        if (paramName) parameters.push({ name: paramName, sharing: paramSharing, semantics: paramSemantics, notes: paramNotes, dataType: dt, order });
      }
    });
    classes.push({ name: fullName, sharing, semantics, notes: classNotes, dimensions, transportation, order, parameters, parent: fullParentName, _source: getSource(doc) });
  });
  return classes;
}
