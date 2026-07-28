import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportJSON, exportFullJSON, exportCSV, exportPrint } from '../src/lib/export.js';

describe('export logic', () => {
  let originalBlob;
  let originalCreateElement;
  let originalPrint;
  let blobSpy;
  let createdElements;

  beforeEach(() => {
    originalBlob = globalThis.Blob;
    originalCreateElement = document.createElement;
    originalPrint = window.print;

    createdElements = [];

    // Spy on Blob constructor
    blobSpy = vi.fn().mockImplementation(function (chunks, options) {
      const b = new originalBlob(chunks, options);
      b._chunks = chunks;
      return b;
    });
    globalThis.Blob = blobSpy;

    // Spy on document.createElement
    document.createElement = vi.fn().mockImplementation(tagName => {
      const el = originalCreateElement.call(document, tagName);
      if (tagName === 'a') {
        createdElements.push(el);
        // Mock click to avoid navigation errors in jsdom
        el.click = vi.fn();
      }
      return el;
    });

    // Mock window.print
    window.print = vi.fn();
  });

  afterEach(() => {
    globalThis.Blob = originalBlob;
    document.createElement = originalCreateElement;
    window.print = originalPrint;
  });

  const mockState = {
    files: [
      {
        name: 'file1.xml',
        version: '1.0',
        dependencies: ['dep1'],
        objectClasses: [{ name: 'obj1' }],
        interactionClasses: [{ name: 'int1' }],
        dataTypes: {
          basic: [{ name: 'b1' }],
          simple: [{ name: 's1' }],
          array: [],
          fixed: [],
          enum: [],
          variant: []
        }
      }
    ],
    mergedFOM: {
      objectClasses: [{ name: 'obj1', parent: 'root', sharing: 'Publish', semantics: 'semantics', attributes: [{ name: 'attr1' }], _sources: ['file1.xml'] }],
      interactionClasses: [{ name: 'int1', parent: 'root', sharing: 'Subscribe', semantics: 'semantics', parameters: [{ name: 'param1' }], _sources: ['file1.xml'] }],
      dimensions: [{ name: 'dim1', dataType: 'float', dimensions: '1', units: 'm' }],
      transportations: [{ name: 'reliable', reliable: 'Yes', semantics: 'rel' }],
      switches: [],
      tags: [],
      notes: [],
      time: null,
      dataTypes: {
        basic: [{ name: 'b1' }],
        simple: [{ name: 's1' }],
        array: [],
        fixed: [],
        enum: [],
        variant: []
      }
    }
  };

  it('exportJSON generates correct JSON structure', () => {
    exportJSON(mockState);
    expect(blobSpy).toHaveBeenCalled();
    const lastCall = blobSpy.mock.calls[0];
    const content = JSON.parse(lastCall[0][0]);

    expect(content.files).toHaveLength(1);
    expect(content.files[0].name).toBe('file1.xml');
    expect(content.merged.objectClasses).toHaveLength(1);
    expect(content.merged.objectClasses[0].name).toBe('obj1');
    expect(createdElements[0].download).toBe('fom-export.json');
  });

  it('exportFullJSON compiles all files and merged data', () => {
    exportFullJSON(mockState);
    expect(blobSpy).toHaveBeenCalled();
    const lastCall = blobSpy.mock.calls[0];
    const content = JSON.parse(lastCall[0][0]);

    expect(content).toHaveProperty('generatedAt');
    expect(content.files).toEqual(mockState.files);
    expect(content.merged).toEqual(mockState.mergedFOM);
    expect(createdElements[0].download).toBe('fom-full-export.json');
  });

  it('exportCSV formats object classes CSV correctly', () => {
    exportCSV(mockState, 'objects');
    expect(blobSpy).toHaveBeenCalled();
    const lastCall = blobSpy.mock.calls[0];
    const csvContent = lastCall[0][0];

    const lines = csvContent.split('\n');
    expect(lines[0]).toBe('Name,Parent,Sharing,Semantics,Attributes,Modules');
    expect(lines[1]).toBe('"obj1","root","Publish","semantics","1","file1.xml"');
    expect(createdElements[0].download).toBe('fom-export.csv');
  });

  it('exportCSV formats interaction classes CSV correctly', () => {
    exportCSV(mockState, 'interactions');
    expect(blobSpy).toHaveBeenCalled();
    const lastCall = blobSpy.mock.calls[0];
    const csvContent = lastCall[0][0];

    const lines = csvContent.split('\n');
    expect(lines[0]).toBe('Name,Parent,Sharing,Semantics,Parameters,Modules');
    expect(lines[1]).toBe('"int1","root","Subscribe","semantics","1","file1.xml"');
  });

  it('exportCSV formats dimensions CSV correctly', () => {
    exportCSV(mockState, 'dims');
    expect(blobSpy).toHaveBeenCalled();
    const lastCall = blobSpy.mock.calls[0];
    const csvContent = lastCall[0][0];

    const lines = csvContent.split('\n');
    expect(lines[0]).toBe('Name,Data Type,Dimensions,Units');
    expect(lines[1]).toBe('"dim1","float","1","m"');
  });

  it('exportPrint triggers window.print', () => {
    exportPrint();
    expect(window.print).toHaveBeenCalled();
  });
});
