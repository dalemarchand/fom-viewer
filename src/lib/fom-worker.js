import { expose } from 'comlink';
import { parseObjectClasses, parseInteractionClasses, parseDataTypes, parseModelIdentificationFull, parseDependencies, parseListElements, parseDimensions, parseTransportations, parseSwitches, parseTags, parseTime, parseNotes, buildFullName, getSource } from './FOM-Parser/index.js';

const worker = {
  parse(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) throw new Error('XML parse error: ' + parseError.textContent);
    const modelIdent = doc.querySelector('modelIdentification');
    const name = modelIdent?.querySelector('name')?.textContent || 'Unknown';
    const version = modelIdent?.querySelector('version')?.textContent || '1.0';
    const dependencies = parseDependencies(modelIdent);
    const objectClasses = parseObjectClasses(doc);
    const interactionClasses = parseInteractionClasses(doc);
    const dataTypes = parseDataTypes(doc);
    const modelIdentification = parseModelIdentificationFull(modelIdent);
    const dimResult = parseDimensions(doc);
    const transResult = parseTransportations(doc);
    const notes = parseNotes(doc);
    const switches = parseSwitches(doc);
    const tags = parseTags(doc);
    const time = parseTime(doc);
    return { name, version, dependencies, objectClasses, interactionClasses, dataTypes, modelIdentification, dimensions: dimResult.result, transportations: transResult.result, transportWarnings: transResult.warnings, notes, switches, tags, time, xml };
  }
};

expose(worker);
