import { getSource } from './core.js';

export function parseDataTypes(doc) {
  const basic = [];
  const basicEls = doc.querySelectorAll('basicData');
  basicEls.forEach(el => {
    const name = el.querySelector('name')?.textContent || '';
    const size = el.querySelector('size')?.textContent || '';
    const encoding = el.querySelector('encoding')?.textContent || '';
    const endian = el.querySelector('endian')?.textContent || '';
    const interpretation = el.querySelector('interpretation')?.textContent || '';
    const semantics = el.querySelector('semantics')?.textContent || '';
    if (name) basic.push({ name, size, encoding, endian, interpretation, semantics, _source: getSource(doc) });
  });
  const simple = [];
  const simpleEls = doc.querySelectorAll('simpleData');
  simpleEls.forEach(el => {
    const name = el.querySelector('name')?.textContent || '';
    const representation = el.querySelector('representation')?.textContent || '';
    const units = el.querySelector('units')?.textContent || '';
    const resolution = el.querySelector('resolution')?.textContent || '';
    const accuracy = el.querySelector('accuracy')?.textContent || '';
    const semantics = el.querySelector('semantics')?.textContent || '';
    const simpleNotes = el.getAttribute('notes') || '';
    if (name) simple.push({ name, representation, units, resolution, accuracy, semantics, notes: simpleNotes, _source: getSource(doc) });
  });
  const array = [];
  const arrayEls = doc.querySelectorAll('arrayData');
  arrayEls.forEach(el => {
    const name = el.querySelector('name')?.textContent || '';
    const dataType = el.querySelector('dataType')?.textContent || '';
    const cardinality = el.querySelector('cardinality')?.textContent || '';
    const encoding = el.querySelector('encoding')?.textContent || '';
    const semantics = el.querySelector('semantics')?.textContent || '';
    const arrayNotes = el.getAttribute('notes') || '';
    if (name) array.push({ name, dataType, cardinality, encoding, semantics, notes: arrayNotes, _source: getSource(doc) });
  });
  const fixed = [];
  const fixedEls = doc.querySelectorAll('fixedRecordData');
  fixedEls.forEach(el => {
    const name = el.querySelector('name')?.textContent || '';
    const encoding = el.querySelector('encoding')?.textContent || '';
    const semantics = el.querySelector('semantics')?.textContent || '';
    const fixedNotes = el.getAttribute('notes') || '';
    const fields = [];
    const fieldEls = el.querySelectorAll('field');
    fieldEls.forEach(field => {
      const fieldName = field.querySelector('name')?.textContent || '';
      const fieldDt = field.querySelector('dataType')?.textContent || '';
      const fieldEncoding = field.querySelector('encoding')?.textContent || '';
      const fieldSemantics = field.querySelector('semantics')?.textContent || '';
      const fieldNotes = field.getAttribute('notes') || '';
      if (fieldName) fields.push({ name: fieldName, dataType: fieldDt, encoding: fieldEncoding, semantics: fieldSemantics, notes: fieldNotes });
    });
    fixed.push({ name, encoding, semantics, notes: fixedNotes, fields, _source: getSource(doc) });
  });
  const enumTypes = [];
  const enumEls = doc.querySelectorAll('enumeratedData');
  enumEls.forEach(el => {
    const name = el.querySelector('name')?.textContent || '';
    const representation = el.querySelector('representation')?.textContent || '';
    const semantics = el.querySelector('semantics')?.textContent || '';
    const enumNotes = el.getAttribute('notes') || '';
    const values = [];
    const valueEls = el.querySelectorAll('enumerator');
    valueEls.forEach(v => {
      const vName = v.querySelector('name')?.textContent || '';
      const vValue = v.querySelector('value')?.textContent || '';
      const vNotes = v.getAttribute('notes') || '';
      if (vName) values.push({ name: vName, value: parseInt(vValue) || 0, notes: vNotes });
    });
    enumTypes.push({ name, representation, semantics, notes: enumNotes, values, _source: getSource(doc) });
  });
  const variant = [];
  const variantEls = doc.querySelectorAll('variantRecordData');
  variantEls.forEach(el => {
    const name = el.querySelector('name')?.textContent || '';
    const discriminant = el.querySelector('discriminant')?.textContent || '';
    const dataType = el.querySelector('dataType')?.textContent || '';
    const encoding = el.querySelector('encoding')?.textContent || '';
    const semantics = el.querySelector('semantics')?.textContent || '';
    const variantNotes = el.getAttribute('notes') || '';
    const alternatives = [];
    const altEls = el.querySelectorAll('alternative');
    altEls.forEach(alt => {
      const altLabel = alt.querySelector('name')?.textContent || '';
      const altEnumeratorRaw = alt.querySelector('enumerator')?.textContent || '';
      const altEnumerators = altEnumeratorRaw.split(',').map(s => s.trim()).filter(Boolean);
      const altDt = alt.querySelector('dataType')?.textContent || '';
      const altSemantics = alt.querySelector('semantics')?.textContent || '';
      const altNotes = alt.getAttribute('notes') || '';
      if (altLabel) alternatives.push({ label: altLabel, enumerators: altEnumerators, dataType: altDt, semantics: altSemantics, notes: altNotes });
    });
    variant.push({ name, discriminant, dataType, encoding, semantics, notes: variantNotes, alternatives, _source: getSource(doc) });
  });
  return { basic, simple, array, fixed, enum: enumTypes, variant };
}
