import { describe, it, expect, beforeAll } from 'vitest';
import { validate, detectCircularDependencies } from '../src/lib/validation.js';

function makeIssue(severity, category, type, title, detail, involved, sources) {
  return {
    id: 'iss-' + String(Math.random()).slice(2, 8),
    severity,
    category,
    type,
    title,
    detail,
    involved,
    sources,
    timestamp: Date.now()
  };
}

function emptyMerged() {
  return { objectClasses: [], interactionClasses: [], dataTypes: { basic: [], simple: [], array: [], fixed: [], enum: [], variant: [] }, transportations: [], switches: [], tags: [], time: null, dimensions: [], notes: [] };
}

describe('validate', () => {
  it('initializes issues to empty array', () => {
    const state = { files: [], mergedFOM: null };
    validate(state, makeIssue);
    expect(Array.isArray(state.issues)).toBe(true);
  });

  it('handles empty files without crashing', () => {
    const state = { files: [], mergedFOM: emptyMerged() };
    validate(state, makeIssue);
    expect(state.issues).toEqual([]);
  });

  it('detects cross-references to unknown data types', () => {
    const state = {
      files: [{
        name: 'Test', objectClasses: [{ name: 'Cls', attributes: [{ name: 'attr1', dataType: 'UnknownType' }] }],
        interactionClasses: [], dataTypes: emptyMerged().dataTypes
      }],
      mergedFOM: {
        ...emptyMerged(),
        objectClasses: [{ name: 'Cls', attributes: [{ name: 'attr1', dataType: 'UnknownType', _source: 'Test' }], _sources: ['Test'] }]
      }
    };
    validate(state, makeIssue);
    expect(state.issues.length).toBeGreaterThan(0);
    expect(state.issues.some(i => i.type === 'missing-data-type')).toBe(true);
  });

  it('detects unknown dimension references', () => {
    const state = {
      files: [{
        name: 'Test', interactionClasses: [{ name: 'HLAinteractionRoot.Interaction', parameters: [], dimensions: ['UnknownDim'] }],
        objectClasses: [], dataTypes: emptyMerged().dataTypes
      }],
      mergedFOM: {
        ...emptyMerged(),
        interactionClasses: [{ name: 'HLAinteractionRoot.Interaction', parameters: [], dimensions: ['UnknownDim'], _sources: ['Test'] }],
        dimensions: [{ name: 'KnownDim', dataType: 'string', dimensions: '', units: '' }]
      }
    };
    validate(state, makeIssue);
    expect(state.issues.some(i => i.type === 'missing-dimension')).toBe(true);
  });

  it('detects unknown transportation references', () => {
    const state = {
      files: [{
        name: 'Test', interactionClasses: [{ name: 'HLAinteractionRoot.Interaction', parameters: [], transportation: 'UnknownTrans' }],
        objectClasses: [], dataTypes: emptyMerged().dataTypes
      }],
      mergedFOM: {
        ...emptyMerged(),
        interactionClasses: [{ name: 'HLAinteractionRoot.Interaction', parameters: [], transportation: 'UnknownTrans', _sources: ['Test'] }],
        transportations: [{ name: 'HLAreliable', reliable: 'Yes' }]
      }
    };
    validate(state, makeIssue);
    expect(state.issues.some(i => i.type === 'missing-transportation')).toBe(true);
  });

  it('detects fixed record field conflicts across multiple files', () => {
    const state = {
      files: [
        { name: 'A', dataTypes: { ...emptyMerged().dataTypes, fixed: [{ name: 'FR', fields: [{ name: 'f1' }, { name: 'f2' }] }] }, objectClasses: [], interactionClasses: [] },
        { name: 'B', dataTypes: { ...emptyMerged().dataTypes, fixed: [{ name: 'FR', fields: [{ name: 'f3' }] }] }, objectClasses: [], interactionClasses: [] }
      ],
      mergedFOM: { ...emptyMerged(), dataTypes: { ...emptyMerged().dataTypes, fixed: [{ name: 'FR', fields: [{ name: 'f1' }, { name: 'f2' }, { name: 'f3' }], _sources: ['A', 'B'] }] } }
    };
    validate(state, makeIssue);
    expect(state.issues.some(i => i.type === 'fixed-record-fields')).toBe(true);
  });

  it('detects enum value conflicts', () => {
    const state = {
      files: [
        { name: 'A', dataTypes: { ...emptyMerged().dataTypes, enum: [{ name: 'E1', values: [{ name: 'A', value: '1' }] }] }, objectClasses: [], interactionClasses: [] },
        { name: 'B', dataTypes: { ...emptyMerged().dataTypes, enum: [{ name: 'E1', values: [{ name: 'B', value: '1' }] }] }, objectClasses: [], interactionClasses: [] }
      ],
      mergedFOM: { ...emptyMerged(), dataTypes: { ...emptyMerged().dataTypes, enum: [{ name: 'E1', values: [{ name: 'A', value: '1' }, { name: 'B', value: '1' }], _sources: ['A', 'B'] }] } }
    };
    validate(state, makeIssue);
    expect(state.issues.some(i => i.type === 'enum-values')).toBe(true);
  });
});

describe('detectCircularDependencies', () => {
  it('detects direct circular dependency A<->B', () => {
    const state = { files: [{ name: 'A', dependencies: ['B'] }, { name: 'B', dependencies: ['A'] }] };
    detectCircularDependencies(state, makeIssue);
    expect(state.issues.length).toBeGreaterThan(0);
    expect(state.issues.some(i => i.type === 'cycle-detected')).toBe(true);
  });

  it('detects self-loop dependency', () => {
    const state = { files: [{ name: 'A', dependencies: ['A'] }, { name: 'B', dependencies: [] }] };
    detectCircularDependencies(state, makeIssue);
    expect(state.issues.some(i => i.type === 'cycle-detected')).toBe(true);
  });

  it('does not flag non-circular dependencies', () => {
    const state = { files: [{ name: 'A', dependencies: [] }, { name: 'B', dependencies: ['A'] }] };
    detectCircularDependencies(state, makeIssue);
    expect(state.issues.filter(i => i.type === 'cycle-detected')).toHaveLength(0);
  });

  it('handles single file without dependencies', () => {
    const state = { files: [{ name: 'A', dependencies: [] }] };
    detectCircularDependencies(state, makeIssue);
    expect(state.issues).toEqual([]);
  });

  it('handles empty file list', () => {
    const state = { files: [] };
    detectCircularDependencies(state, makeIssue);
    expect(state.issues).toEqual([]);
  });
});
