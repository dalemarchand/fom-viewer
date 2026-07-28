import { describe, it, expect } from 'vitest';
import { parseObjectClasses, parseInteractionClasses, parseDataTypes, parseModelIdentificationFull, buildFullName } from '../src/lib/FOM-Parser/index.js';
import { detectCircularDependencies } from '../src/lib/validation.js';

function parseXML(xmlString) {
  return new DOMParser().parseFromString(xmlString, 'text/xml');
}

function makeIssue(severity, category, type, title, detail, involved, sources) {
  return { severity, category, type, title, detail, involved, sources };
}

describe('parser boundaries', () => {
  it('handles completely empty XML document without crashing', () => {
    const doc = parseXML('<objectModel></objectModel>');
    
    expect(() => {
      const objClasses = parseObjectClasses(doc);
      expect(objClasses).toEqual([]);
    }).not.toThrow();

    expect(() => {
      const intClasses = parseInteractionClasses(doc);
      expect(intClasses).toEqual([]);
    }).not.toThrow();

    expect(() => {
      const dataTypes = parseDataTypes(doc);
      expect(dataTypes.basic).toEqual([]);
      expect(dataTypes.simple).toEqual([]);
      expect(dataTypes.array).toEqual([]);
      expect(dataTypes.fixed).toEqual([]);
      expect(dataTypes.enum).toEqual([]);
      expect(dataTypes.variant).toEqual([]);
    }).not.toThrow();
  });

  it('handles missing modelIdentification gracefully', () => {
    expect(() => {
      const res = parseModelIdentificationFull(null);
      expect(res).toEqual([]);
    }).not.toThrow();
  });

  it('buildFullName constructs hierarchical names correctly', () => {
    const doc = parseXML('<objectClass><name>HLAobjectRoot</name><objectClass><name>Parent</name><objectClass><name>Child</name></objectClass></objectClass></objectClass>');
    const childEl = doc.querySelector('objectClass > objectClass > objectClass');
    const fullName = buildFullName(childEl, ['objectClass']);
    expect(fullName).toBe('HLAobjectRoot.Parent.Child');
  });

  it('buildFullName handles loop/unmatched parent resolution gracefully', () => {
    const doc = parseXML('<objectClass><name>Child</name></objectClass>');
    const childEl = doc.querySelector('objectClass');
    // Pass empty tags array so parent isn't matched
    const fullName = buildFullName(childEl, []);
    expect(fullName).toBe('Child');
  });
});

describe('circular dependency edge cases (QA Engineer recommendations)', () => {
  it('detects self-referencing modules (A depends on A)', () => {
    const state = {
      files: [
        { name: 'A', dependencies: ['A'] },
        { name: 'B', dependencies: [] }
      ],
      issues: []
    };
    detectCircularDependencies(state, makeIssue);
    expect(state.issues).toHaveLength(1);
    expect(state.issues[0].type).toBe('cycle-detected');
    expect(state.issues[0].involved).toContain('A');
  });

  it('detects complex multi-file cycle chains (A -> B -> C -> A)', () => {
    const state = {
      files: [
        { name: 'A', dependencies: ['B'] },
        { name: 'B', dependencies: ['C'] },
        { name: 'C', dependencies: ['A'] }
      ],
      issues: []
    };
    detectCircularDependencies(state, makeIssue);
    expect(state.issues).toHaveLength(1);
    expect(state.issues[0].type).toBe('cycle-detected');
    expect(state.issues[0].involved).toContain('A');
    expect(state.issues[0].involved).toContain('B');
    expect(state.issues[0].involved).toContain('C');
  });

  it('handles modules referencing missing/non-existent modules without cycles', () => {
    const state = {
      files: [
        { name: 'A', dependencies: ['NONEXISTENT'] },
        { name: 'B', dependencies: [] }
      ],
      issues: []
    };
    detectCircularDependencies(state, makeIssue);
    expect(state.issues).toHaveLength(0);
  });
});
