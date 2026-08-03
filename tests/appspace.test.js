import { describe, it, expect } from 'vitest';
import { parseAppspaceFile, findClassByRightSideMatch, classifyAppspaceEntries } from '../src/lib/appspace.js';

describe('appspace parsing logic', () => {
  it('parses pipe-separated formats correctly', () => {
    const content = `
      # This is a comment
      HLAobjectRoot.DynamicObject|SIM_APP,LOG_APP
      HLAobjectRoot.DynamicObject.Vehicle|SIM_APP
    `;
    const entries = parseAppspaceFile(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].className).toBe('HLAobjectRoot.DynamicObject');
    expect(entries[0].apps).toEqual(['SIM_APP', 'LOG_APP']);
    expect(entries[1].className).toBe('HLAobjectRoot.DynamicObject.Vehicle');
    expect(entries[1].apps).toEqual(['SIM_APP']);
  });

  it('parses comma and semicolon-separated CSV layouts correctly', () => {
    const content = `
      classname,apps
      HLAobjectRoot.DynamicObject,SIM_APP;LOG_APP
      HLAobjectRoot.DynamicObject.Person,"SIM_APP","LOG_APP"
    `;
    const entries = parseAppspaceFile(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].className).toBe('HLAobjectRoot.DynamicObject');
    expect(entries[0].apps).toEqual(['SIM_APP', 'LOG_APP']);
    expect(entries[1].className).toBe('HLAobjectRoot.DynamicObject.Person');
    expect(entries[1].apps).toEqual(['SIM_APP', 'LOG_APP']);
  });

  it('skips comments, whitespace lines, headers, and malformed entries', () => {
    const content = `
      # Comment row
      ClassName,Apps
      
      MalformedRowWithoutDelimiter
      HLAobjectRoot|
      |App1,App2
    `;
    const entries = parseAppspaceFile(content);
    expect(entries).toHaveLength(0);
  });
});

describe('appspace suffix matching logic', () => {
  const classes = [
    { name: 'HLAobjectRoot.HLAfederate' },
    { name: 'HLAobjectRoot.HLAmanager.HLAfederate' }
  ];

  it('performs exact matching', () => {
    const match = findClassByRightSideMatch('HLAobjectRoot.HLAfederate', classes);
    expect(match).not.toBeNull();
    expect(match.name).toBe('HLAobjectRoot.HLAfederate');
  });

  it('performs partial suffix matching', () => {
    const match = findClassByRightSideMatch('HLAmanager.HLAfederate', classes);
    expect(match).not.toBeNull();
    expect(match.name).toBe('HLAobjectRoot.HLAmanager.HLAfederate');
  });

  it('selects the longest suffix match in case of multiple candidates', () => {
    // Both entries in classes end in HLAfederate.
    // HLAmanager.HLAfederate matches both, but has a 2-segment match on index 1, versus 1-segment on index 0.
    const match = findClassByRightSideMatch('HLAmanager.HLAfederate', classes);
    expect(match.name).toBe('HLAobjectRoot.HLAmanager.HLAfederate');
  });

  it('enforces strict case sensitivity', () => {
    const match = findClassByRightSideMatch('hlafederate', classes);
    expect(match).toBeNull();
  });
});

describe('appspace classification logic', () => {
  const objectClasses = [
    { name: 'HLAobjectRoot.HLAmanager.HLAfederate' }
  ];
  const interactionClasses = [
    { name: 'HLAinteractionRoot.HLAmanager.HLAfederate' }
  ];

  it('correctly partitions entries into objects, interactions, and unknown', () => {
    const entries = [
      { className: 'HLAobjectRoot.HLAmanager.HLAfederate', apps: ['App1'] },
      { className: 'HLAinteractionRoot.HLAmanager.HLAfederate', apps: ['App2'] },
      { className: 'UnknownClassInHierarchy', apps: ['App3'] }
    ];

    const res = classifyAppspaceEntries(entries, objectClasses, interactionClasses);
    expect(res.objects).toHaveLength(1);
    expect(res.objects[0].matchedClass).toBe('HLAobjectRoot.HLAmanager.HLAfederate');

    expect(res.interactions).toHaveLength(1);
    expect(res.interactions[0].matchedClass).toBe('HLAinteractionRoot.HLAmanager.HLAfederate');

    expect(res.unknown).toHaveLength(1);
    expect(res.unknown[0].className).toBe('UnknownClassInHierarchy');
  });

  it('handles empty class lists without errors', () => {
    const entries = [
      { className: 'AnyClass', apps: ['App'] }
    ];
    const res = classifyAppspaceEntries(entries, [], []);
    expect(res.objects).toHaveLength(0);
    expect(res.interactions).toHaveLength(0);
    expect(res.unknown).toHaveLength(1);
  });

  it('correctly differentiates identical base object and interaction class names by full hierarchical name', () => {
    const objs = [
      { name: 'HLAobjectRoot.Manager' },
      { name: 'HLAobjectRoot.HLAmanager.HLAfederate' }
    ];
    const ints = [
      { name: 'HLAinteractionRoot.Manager' },
      { name: 'HLAinteractionRoot.HLAmanager.HLAfederate' }
    ];

    const entries = [
      { className: 'HLAobjectRoot.Manager', apps: ['AppObject'] },
      { className: 'HLAinteractionRoot.Manager', apps: ['AppInteraction'] },
      { className: 'Manager', apps: ['AppShared'] }
    ];

    const res = classifyAppspaceEntries(entries, objs, ints);

    // Full hierarchical name matching
    const objectManager = res.objects.find(e => e.className === 'HLAobjectRoot.Manager');
    expect(objectManager).toBeDefined();
    expect(objectManager.matchedClass).toBe('HLAobjectRoot.Manager');

    const interactionManager = res.interactions.find(e => e.className === 'HLAinteractionRoot.Manager');
    expect(interactionManager).toBeDefined();
    expect(interactionManager.matchedClass).toBe('HLAinteractionRoot.Manager');

    // Ensure full hierarchical names didn't cross-match
    expect(res.objects.find(e => e.className === 'HLAinteractionRoot.Manager')).toBeUndefined();
    expect(res.interactions.find(e => e.className === 'HLAobjectRoot.Manager')).toBeUndefined();

    // Short/base name matching matches both
    const sharedObject = res.objects.find(e => e.className === 'Manager');
    const sharedInteraction = res.interactions.find(e => e.className === 'Manager');
    expect(sharedObject).toBeDefined();
    expect(sharedObject.matchedClass).toBe('HLAobjectRoot.Manager');
    expect(sharedInteraction).toBeDefined();
    expect(sharedInteraction.matchedClass).toBe('HLAinteractionRoot.Manager');
  });
});

