import { describe, it, expect } from 'vitest';
import { topologicalSort, mergeClasses, mergeTransportations, mergeDataTypes, mergeSwitches, mergeTags, mergeTime } from '../src/lib/merge.js';

describe('topologicalSort', () => {
  it('returns files in order when no dependencies', () => {
    const files = [
      { name: 'A', dependencies: [] },
      { name: 'B', dependencies: [] }
    ];
    const result = topologicalSort(files);
    expect(result).toHaveLength(2);
  });

  it('sorts by dependency order', () => {
    const files = [
      { name: 'B', dependencies: ['A'] },
      { name: 'A', dependencies: [] }
    ];
    const result = topologicalSort(files);
    expect(result[0].name).toBe('A');
    expect(result[1].name).toBe('B');
  });

  it('handles chain dependencies', () => {
    const files = [
      { name: 'C', dependencies: ['B'] },
      { name: 'B', dependencies: ['A'] },
      { name: 'A', dependencies: [] }
    ];
    const result = topologicalSort(files);
    expect(result.map(f => f.name)).toEqual(['A', 'B', 'C']);
  });

  it('handles missing dependency references gracefully', () => {
    const files = [
      { name: 'A', dependencies: ['NONEXISTENT'] }
    ];
    const result = topologicalSort(files);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });
});

describe('mergeClasses', () => {
  it('merges object classes from multiple files', () => {
    const files = [
      { name: 'A', objectClasses: [{ name: 'HLAobjectRoot', attributes: [{ name: 'attr1' }] }], interactionClasses: [] },
      { name: 'B', objectClasses: [{ name: 'HLAobjectRoot', attributes: [{ name: 'attr2' }] }], interactionClasses: [] }
    ];
    const result = mergeClasses(files, 'object');
    expect(result).toHaveLength(1);
    expect(result[0].attributes).toHaveLength(2);
    expect(result[0]._sources).toEqual(['A', 'B']);
  });

  it('deduplicates attributes with same name across files', () => {
    const files = [
      { name: 'A', objectClasses: [{ name: 'Cls', attributes: [{ name: 'attr1' }, { name: 'attr2' }] }], interactionClasses: [] },
      { name: 'B', objectClasses: [{ name: 'Cls', attributes: [{ name: 'attr1' }] }], interactionClasses: [] }
    ];
    const result = mergeClasses(files, 'object');
    expect(result[0].attributes).toHaveLength(2);
  });

  it('tracks source file for each attribute', () => {
    const files = [
      { name: 'A', objectClasses: [{ name: 'Cls', attributes: [{ name: 'attr1' }] }], interactionClasses: [] },
      { name: 'B', objectClasses: [{ name: 'Cls', attributes: [{ name: 'attr2' }] }], interactionClasses: [] }
    ];
    const result = mergeClasses(files, 'object');
    const attr1 = result[0].attributes.find(a => a.name === 'attr1');
    expect(attr1._source).toBe('A');
    const attr2 = result[0].attributes.find(a => a.name === 'attr2');
    expect(attr2._source).toBe('B');
  });

  it('merges interaction classes with parameters', () => {
    const files = [
      { name: 'A', objectClasses: [], interactionClasses: [{ name: 'HLAinteractionRoot', parameters: [{ name: 'p1' }] }] },
      { name: 'B', objectClasses: [], interactionClasses: [{ name: 'HLAinteractionRoot', parameters: [{ name: 'p2' }] }] }
    ];
    const result = mergeClasses(files, 'interaction');
    expect(result).toHaveLength(1);
    expect(result[0].parameters).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(mergeClasses([], 'object')).toEqual([]);
    expect(mergeClasses([], 'interaction')).toEqual([]);
  });
});

describe('mergeTransportations', () => {
  it('merges transportations with conflict detection', () => {
    const files = [
      { name: 'A', transportations: [{ name: 'HLAreliable', reliable: 'Yes', semantics: 'Reliable' }] },
      { name: 'B', transportations: [{ name: 'HLAreliable', reliable: 'Yes' }] }
    ];
    const result = mergeTransportations(files);
    expect(result).toHaveLength(1);
    expect(result[0]._sources).toHaveLength(2);
  });

  it('detects reliable conflicts', () => {
    const files = [
      { name: 'A', transportations: [{ name: 'T1', reliable: 'Yes' }] },
      { name: 'B', transportations: [{ name: 'T1', reliable: 'No' }] }
    ];
    const result = mergeTransportations(files);
    expect(result[0].reliable).toBe('Yes');
  });

  it('merges rows from multiple files', () => {
    const files = [
      { name: 'A', transportations: [{ name: 'T1', rows: [{ key: 'k1', value: 'v1' }] }] },
      { name: 'B', transportations: [{ name: 'T1', rows: [{ key: 'k2', value: 'v2' }] }] }
    ];
    const result = mergeTransportations(files);
    expect(result[0].rows).toHaveLength(2);
  });

  it('deduplicates identical rows', () => {
    const files = [
      { name: 'A', transportations: [{ name: 'T1', rows: [{ key: 'k1', value: 'v1' }] }] },
      { name: 'B', transportations: [{ name: 'T1', rows: [{ key: 'k1', value: 'v1' }] }] }
    ];
    const result = mergeTransportations(files);
    expect(result[0].rows).toHaveLength(1);
  });
});

describe('mergeDataTypes', () => {
  it('merges basic data types', () => {
    const files = [
      { name: 'A', dataTypes: { basic: [{ name: 'T1', _source: 'A' }], simple: [], array: [], fixed: [], enum: [], variant: [] } },
      { name: 'B', dataTypes: { basic: [{ name: 'T2', _source: 'B' }], simple: [], array: [], fixed: [], enum: [], variant: [] } }
    ];
    const { result } = mergeDataTypes(files);
    expect(result.basic).toHaveLength(2);
  });

  it('deduplicates data types by name', () => {
    const files = [
      { name: 'A', dataTypes: { basic: [{ name: 'T1', _source: 'A' }], simple: [], array: [], fixed: [], enum: [], variant: [] } },
      { name: 'B', dataTypes: { basic: [{ name: 'T1', _source: 'B' }], simple: [], array: [], fixed: [], enum: [], variant: [] } }
    ];
    const { result } = mergeDataTypes(files);
    expect(result.basic).toHaveLength(1);
    expect(result.basic[0]._sources).toEqual(['A', 'B']);
  });

  it('merges fixed record fields', () => {
    const files = [
      { name: 'A', dataTypes: { basic: [], simple: [], array: [], fixed: [{ name: 'F1', _source: 'A', fields: [{ name: 'f1' }] }], enum: [], variant: [] } },
      { name: 'B', dataTypes: { basic: [], simple: [], array: [], fixed: [{ name: 'F1', _source: 'B', fields: [{ name: 'f2' }] }], enum: [], variant: [] } }
    ];
    const { result } = mergeDataTypes(files);
    expect(result.fixed).toHaveLength(1);
    expect(result.fixed[0].fields).toHaveLength(2);
  });

  it('returns all 6 type categories', () => {
    const { result } = mergeDataTypes([]);
    expect(Object.keys(result)).toEqual(['basic', 'simple', 'array', 'fixed', 'enum', 'variant']);
  });
});

describe('mergeSwitches', () => {
  it('merges switches from multiple files', () => {
    const files = [
      { name: 'A', switches: [{ name: 'S1', dataType: 'Boolean' }] },
      { name: 'B', switches: [{ name: 'S2', dataType: 'Boolean' }] }
    ];
    const result = mergeSwitches(files);
    expect(result).toHaveLength(2);
  });

  it('deduplicates same switch name', () => {
    const files = [
      { name: 'A', switches: [{ name: 'S1' }] },
      { name: 'B', switches: [{ name: 'S1' }] }
    ];
    const result = mergeSwitches(files);
    expect(result).toHaveLength(1);
    expect(result[0]._sources).toEqual(['A', 'B']);
  });

  it('handles files without switches', () => {
    expect(mergeSwitches([{ name: 'A' }])).toEqual([]);
  });
});

describe('mergeTags', () => {
  it('merges tags from multiple files', () => {
    const files = [
      { name: 'A', tags: [{ name: 'tag1', dataType: 'string' }] },
      { name: 'B', tags: [{ name: 'tag2', dataType: 'string' }] }
    ];
    const result = mergeTags(files);
    expect(result).toHaveLength(2);
  });
});

describe('mergeTime', () => {
  it('merges time from first file with data', () => {
    const files = [
      { name: 'A', time: { timeStamp: { dataType: 'HLAinteger64Time' } } },
      { name: 'B', time: {} }
    ];
    const result = mergeTime(files);
    expect(result.timeStamp.dataType).toBe('HLAinteger64Time');
  });

  it('uses first available timestamp and lookahead', () => {
    const files = [
      { name: 'A', time: { timeStamp: { dataType: 'T1' }, lookahead: { dataType: 'L1' } } },
      { name: 'B', time: { timeStamp: { dataType: 'T2' }, lookahead: { dataType: 'L2' } } }
    ];
    const result = mergeTime(files);
    expect(result.timeStamp.dataType).toBe('T1');
    expect(result.lookahead.dataType).toBe('L1');
  });

  it('returns empty object when no time data', () => {
    expect(mergeTime([{ name: 'A' }])).toEqual({});
  });
});
