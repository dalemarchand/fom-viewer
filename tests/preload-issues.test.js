import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { topologicalSort, mergeClasses, mergeTransportations, mergeDataTypes, mergeSwitches, mergeTags, mergeTime } from '../src/lib/merge.js';
import { validate } from '../src/lib/validation.js';
import { parseDependencies, parseObjectClasses, parseInteractionClasses, parseDataTypes, parseModelIdentificationFull, parseDimensions, parseTransportations, parseSwitches, parseTags, parseTime, parseNotes } from '../src/lib/FOM-Parser/index.js';

describe('Validation parity between standard load and preloaded bundle', () => {
  const fomDir = path.resolve(process.cwd(), 'test/fom');
  const testFiles = ['HLAstandardMIM.xml', 'RPR-Foundation_v3.0.xml', 'RPR-Base_v3.0.xml', 'RPR-Physical_v3.0.xml', 'RPR-Enumerations_v3.0.xml'];

  function parseFile(xml) {
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const doc = dom.window.document;
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
    return { name, version, dependencies, objectClasses, interactionClasses, dataTypes, modelIdentification, dimensions: dimResult.result, transportations: transResult.result, notes, switches, tags, time, xml };
  }

  function runValidationWithFix(preloadedMode) {
    const stateFiles = testFiles.map(fn => {
      const xml = fs.readFileSync(path.join(fomDir, fn), 'utf8');
      const fom = parseFile(xml);
      fom.fileName = fn;
      if (preloadedMode && (!fom.name || fom.name === 'Unknown')) {
        fom.name = fn;
      }
      return fom;
    });

    const sorted = topologicalSort(stateFiles);
    const dtResult = mergeDataTypes(sorted);
    const mergedFOM = {
      objectClasses: mergeClasses(sorted, 'object'),
      interactionClasses: mergeClasses(sorted, 'interaction'),
      dataTypes: dtResult.result,
      transportations: mergeTransportations(sorted),
      switches: mergeSwitches(sorted),
      tags: mergeTags(sorted),
      time: mergeTime(sorted)
    };

    const state = {
      files: stateFiles,
      mergedFOM,
      issues: []
    };

    const makeIssue = (severity, category, type, title, detail, sources, locations) => ({
      severity, category, type, title, detail, sources, locations
    });

    validate(state, makeIssue);

    return {
      total: state.issues.length,
      errors: state.issues.filter(i => i.severity === 'error').length,
      warnings: state.issues.filter(i => i.severity === 'warning').length,
      issues: state.issues
    };
  }

  it('yields identical issues for standard and preloaded bundle modes', { timeout: 15000 }, () => {
    const standard = runValidationWithFix(false);
    const preloaded = runValidationWithFix(true);

    expect(preloaded.total).toBe(standard.total);
    expect(preloaded.errors).toBe(standard.errors);
    expect(preloaded.warnings).toBe(standard.warnings);
  });
});
