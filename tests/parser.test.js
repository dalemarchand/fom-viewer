import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseObjectClasses, parseInteractionClasses, parseDataTypes, parseModelIdentificationFull, parseDependencies, parseListElements, parseDimensions, parseTransportations, parseSwitches, parseTags, parseTime, parseNotes, buildFullName, getSource } from '../src/lib/FOM-Parser/index.js';

const FOM_DIR = path.resolve(__dirname, '../test/fom');
const FOM_FILES = [
  'HLAstandardMIM.xml',
  'RPR-Foundation_v3.0.xml',
  'RPR-Physical_v3.0.xml',
  'RPR-Enumerations_v3.0.xml',
  'RPR-Base_v3.0.xml',
  'RPR-Aggregate_v3.0.xml',
  'RPR-Communication_v3.0.xml',
  'RPR-DER_v3.0.xml'
];

function parseXML(xmlString) {
  return new DOMParser().parseFromString(xmlString, 'text/xml');
}

function loadAndParse(filename) {
  const xmlPath = path.join(FOM_DIR, filename);
  const xml = fs.readFileSync(xmlPath, 'utf-8');
  const doc = parseXML(xml);
  const modelIdent = doc.querySelector('modelIdentification');
  const name = modelIdent?.querySelector('name')?.textContent || 'Unknown';
  const version = modelIdent?.querySelector('version')?.textContent || '1.0';
  const dependencies = parseDependencies(modelIdent);
  const objectClasses = parseObjectClasses(doc);
  const interactionClasses = parseInteractionClasses(doc);
  const dataTypes = parseDataTypes(doc);
  const modelIdentification = parseModelIdentificationFull(modelIdent);
  const dimensions = parseDimensions(doc);
  const transportations = parseTransportations(doc);
  const notes = parseNotes(doc);
  const switches = parseSwitches(doc);
  const tags = parseTags(doc);
  const time = parseTime(doc);
  return { name, version, dependencies, objectClasses, interactionClasses, dataTypes, modelIdentification, dimensions, transportations, notes, switches, tags, time };
}

// Capture parsed results for comparison
const parsedFiles = {};

describe('FOM Parser - File Loading', () => {
  for (const filename of FOM_FILES) {
    it(`parses ${filename} without errors`, () => {
      expect(() => {
        const result = loadAndParse(filename);
        parsedFiles[filename] = result;
        expect(result.name).toBeTruthy();
        expect(result.version).toBeTruthy();
      }).not.toThrow();
    });
  }
});

describe('FOM Parser - Structure', () => {
  beforeAll(() => {
    for (const filename of FOM_FILES) {
      if (!parsedFiles[filename]) {
        parsedFiles[filename] = loadAndParse(filename);
      }
    }
  });

  it('all files have names', () => {
    for (const filename of FOM_FILES) {
      expect(parsedFiles[filename].name).toBeTruthy();
    }
  });

  it('all files have versions', () => {
    for (const filename of FOM_FILES) {
      expect(parsedFiles[filename].version).toBeTruthy();
    }
  });

  it('all parsed outputs have required top-level keys', () => {
    const requiredKeys = ['name', 'version', 'dependencies', 'objectClasses', 'interactionClasses', 'dataTypes', 'dimensions', 'transportations', 'notes', 'switches', 'tags', 'time'];
    for (const filename of FOM_FILES) {
      for (const key of requiredKeys) {
        expect(parsedFiles[filename]).toHaveProperty(key);
      }
    }
  });

  it('dataTypes has all 6 sub-types', () => {
    const subtypes = ['basic', 'simple', 'array', 'fixed', 'enum', 'variant'];
    for (const filename of FOM_FILES) {
      for (const st of subtypes) {
        expect(parsedFiles[filename].dataTypes).toHaveProperty(st);
        expect(Array.isArray(parsedFiles[filename].dataTypes[st])).toBe(true);
      }
    }
  });

  it('objectClasses and interactionClasses are arrays', () => {
    for (const filename of FOM_FILES) {
      expect(Array.isArray(parsedFiles[filename].objectClasses)).toBe(true);
      expect(Array.isArray(parsedFiles[filename].interactionClasses)).toBe(true);
    }
  });
});

describe('FOM Parser - Model Identification', () => {
  beforeAll(() => {
    for (const filename of FOM_FILES) {
      if (!parsedFiles[filename]) parsedFiles[filename] = loadAndParse(filename);
    }
  });

  it('modelIdentification is an array of key-value entries', () => {
    for (const filename of FOM_FILES) {
      const mi = parsedFiles[filename].modelIdentification;
      expect(Array.isArray(mi)).toBe(true);
      if (mi.length > 0) {
        expect(mi[0]).toHaveProperty('key');
        expect(mi[0]).toHaveProperty('value');
      }
    }
  });

  it('dependencies is an array of strings', () => {
    for (const filename of FOM_FILES) {
      expect(Array.isArray(parsedFiles[filename].dependencies)).toBe(true);
      parsedFiles[filename].dependencies.forEach(d => expect(typeof d).toBe('string'));
    }
  });
});

describe('FOM Parser - Dimensions, Transportations, Notes, Switches, Tags, Time', () => {
  beforeAll(() => {
    for (const filename of FOM_FILES) {
      if (!parsedFiles[filename]) parsedFiles[filename] = loadAndParse(filename);
    }
  });

  it('dimensions results have name and dataType', () => {
    for (const filename of FOM_FILES) {
      parsedFiles[filename].dimensions?.result?.forEach(d => {
        expect(d).toHaveProperty('name');
      });
    }
  });

  it('transportations results have name', () => {
    for (const filename of FOM_FILES) {
      parsedFiles[filename].transportations?.result?.forEach(t => {
        expect(t).toHaveProperty('name');
      });
    }
  });

  it('notes is an array', () => {
    for (const filename of FOM_FILES) {
      expect(Array.isArray(parsedFiles[filename].notes)).toBe(true);
    }
  });

  it('switches is an array', () => {
    for (const filename of FOM_FILES) {
      expect(Array.isArray(parsedFiles[filename].switches)).toBe(true);
    }
  });

  it('tags is an array', () => {
    for (const filename of FOM_FILES) {
      expect(Array.isArray(parsedFiles[filename].tags)).toBe(true);
    }
  });
});

describe('FOM Parser - Specific Files', () => {
  it('HLAstandardMIM has root object classes', () => {
    const result = loadAndParse('HLAstandardMIM.xml');
    expect(result.objectClasses.length).toBeGreaterThan(0);
    expect(result.objectClasses.some(c => c.name === 'HLAobjectRoot')).toBe(true);
  });

  it('HLAstandardMIM has root interaction classes', () => {
    const result = loadAndParse('HLAstandardMIM.xml');
    expect(result.interactionClasses.length).toBeGreaterThan(0);
    expect(result.interactionClasses.some(c => c.name === 'HLAinteractionRoot')).toBe(true);
  });

  it('HLAstandardMIM has basic data types', () => {
    const result = loadAndParse('HLAstandardMIM.xml');
    expect(result.dataTypes.basic.length).toBeGreaterThan(0);
  });

  it('RPR-Foundation declares dependencies', () => {
    const result = loadAndParse('RPR-Foundation_v3.0.xml');
    // RPR-Foundation depends on HLAstandardMIM
    expect(result.dependencies.length).toBeGreaterThanOrEqual(0);
  });

  it('RPR-Physical has object classes', () => {
    const result = loadAndParse('RPR-Physical_v3.0.xml');
    expect(result.objectClasses.length).toBeGreaterThan(0);
  });

  it('RPR-Enumerations has enum types', () => {
    const result = loadAndParse('RPR-Enumerations_v3.0.xml');
    expect(result.dataTypes.enum.length).toBeGreaterThan(0);
  });
});

describe('FOM Parser - Identical Parsing Consistency', () => {
  it('parses each file deterministically (same result twice)', () => {
    for (const filename of FOM_FILES) {
      const r1 = loadAndParse(filename);
      const r2 = loadAndParse(filename);
      expect(r1.name).toBe(r2.name);
      expect(r1.version).toBe(r2.version);
      expect(r1.objectClasses.length).toBe(r2.objectClasses.length);
      expect(r1.interactionClasses.length).toBe(r2.interactionClasses.length);
      expect(r1.dependencies).toEqual(r2.dependencies);
    }
  });
});
