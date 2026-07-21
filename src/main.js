// ============================================================================
// SVELTE APP ENTRY
// ============================================================================

import { mount } from 'svelte';
import App from './App.svelte';
import './styles.css';
import { wrap } from 'comlink';
import Fuse from 'fuse.js';

mount(App, { target: document.getElementById('svelte-root') });

let workerInstance = null;
let workerProxy = null;
let workerFailed = false;
let FomWorker = null;

async function parseInWorker(xml) {
  if (window.location.protocol === 'file:') {
    return parseSync(xml);
  }
  if (!workerProxy && !workerFailed) {
    try {
      if (!FomWorker) {
        const module = await import('./lib/fom-worker.js?worker&inline');
        FomWorker = module.default;
      }
      workerInstance = new FomWorker();
      workerProxy = wrap(workerInstance);
    } catch (e) {
      workerFailed = true;
    }
  }
  if (workerProxy) {
    try {
      const workerPromise = workerProxy.parse(xml);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Worker timeout')), 500)
      );
      return await Promise.race([workerPromise, timeoutPromise]);
    }
    catch (e) {
      console.warn('Worker parsing failed or timed out, falling back to sync parsing:', e);
      workerFailed = true;
      if (workerInstance) {
        try { workerInstance.terminate(); } catch (err) {}
        workerInstance = null;
      }
      workerProxy = null;
    }
  }
  return parseSync(xml);
}

function parseSync(xml) {
  const parser = new FOMParser(xml);
  return parser.parse();
}

// Track style changes on detailHeader
function trackDetailHeader() {
  const dh = document.getElementById('detailHeader');
  if (!dh) { setTimeout(trackDetailHeader, 50); return; }
  const obs = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'attributes' && r.attributeName === 'style') {
        const title = document.getElementById('detailTitle');
        console.log('[DH-MUTATION] style.display=' + dh.style.display + ' title=' + (title ? title.innerHTML : 'null'));
      }
    }
  });
  obs.observe(dh, { attributes: true, attributeFilter: ['style'] });
  console.log('[DH-MUTATION] observer attached');
}
setTimeout(trackDetailHeader, 50);

import { parseObjectClasses, parseInteractionClasses, parseDataTypes, parseModelIdentificationFull, parseDependencies, parseListElements, parseDimensions, parseTransportations, parseSwitches, parseTags, parseTime, parseNotes, buildFullName, getSource } from './lib/FOM-Parser/index.js';
import { topologicalSort, mergeClasses, mergeTransportations, mergeDataTypes, mergeSwitches, mergeTags, mergeTime } from './lib/merge.js';
import { validate, updateIssuesTabVisibility, detectCircularDependencies } from './lib/validation.js';
import { exportJSON, exportFullJSON, exportCSV, exportPrint } from './lib/export.js';
import * as fomStore from './lib/stores/fomStore.svelte.js';
import * as uiStore from './lib/stores/uiStore.svelte.js';
import * as historyStore from './lib/stores/historyStore.svelte.js';
import * as issueStore from './lib/stores/issueStore.svelte.js';
import * as storage from './lib/storage.js';
import * as searchStore from './lib/stores/searchStore.svelte.js';
import { initRecentFiles, addRecentFile } from './lib/stores/recentFilesStore.svelte.js';
import * as appspaceStore from './lib/stores/appspaceStore.svelte.js';
import customConfig from './custom-config.json';

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(16);
}

function reclassifyAppspace() {
  if (state.appspace && state.appspace.rawContent && state.mergedFOM) {
    const entries = parseAppspaceFile(state.appspace.rawContent);
    const classified = classifyAppspaceEntries(entries, state.mergedFOM.objectClasses || [], state.mergedFOM.interactionClasses || []);
    state.appspace.entries = classified.objects;
    state.appspace.interactions = classified.interactions;
    state.appspace.unknown = classified.unknown;
    updateAppspaceTabCount();
  }
}

// ============================================================================
// CONSTANTS & STATE
// ============================================================================

const DEBUG_BACK_BUTTON = false;

const state = {
  // Delegated to stores
  get files() { return fomStore.getFiles(); },
  set files(v) { fomStore.setFiles(v); },
  get mergedFOM() { return fomStore.getMergedFOM(); },
  set mergedFOM(v) { fomStore.setMergedFOM(v); },
  get currentTab() { return uiStore.getCurrentTab(); },
  set currentTab(v) { uiStore.setCurrentTab(v); },
  get currentSubTab() { return uiStore.getCurrentSubTab(); },
  set currentSubTab(v) { uiStore.setCurrentSubTab(v); },
  get selectedItem() { return uiStore.getSelectedItem(); },
  set selectedItem(v) { uiStore.setSelectedItem(v); },
  get sortEnabled() { return uiStore.getSortEnabled(); },
  set sortEnabled(v) { uiStore.setSortEnabled(v); },
  get issues() { return issueStore.getIssues(); },
  set issues(v) { issueStore.setIssues(v); },
  get issuesFilter() { return issueStore.getIssuesFilter(); },
  set issuesFilter(v) { issueStore.setIssuesFilter(v); },
  get appspaceSubTab() { return uiStore.getAppspaceSubTab(); },
  set appspaceSubTab(v) { uiStore.setAppspaceSubTab(v); },
  // Data properties (not yet store-delegated)
  history: [],
  conflicts: [],
  errors: [],
  appspace: null,
  subspaceDimensions: [],
  uiState: {
    currentTab: 'modules',
    currentSubTab: 'basic',
    selectedItem: null,
    sortEnabled: 'asc'
  }
};

let issueCounter = 0;

function makeIssue(severity, category, type, message, detail, sources, locations) {
  return {
    id: `iss-${String(++issueCounter).padStart(3, '0')}`,
    severity,
    category,
    type,
    message,
    detail: detail || '',
    sources: sources || [],
    locations: locations || []
  };
}

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

function debugBack(msg, ...args) {
  if (DEBUG_BACK_BUTTON) console.log('[BACK]', msg, ...args);
}

// ============================================================================
// DATABASE (IndexedDB for file caching)
// ============================================================================

// ============================================================================
// STORAGE (IndexedDB persistence)
// ============================================================================

async function saveToStorage() {
  const fileData = state.files.map(f => ({ name: f.name, xml: f.xml }));
  const sel = state.selectedItem;
  const uiState = { currentTab: state.currentTab, currentSubTab: state.currentSubTab, selectedItem: sel ? { name: sel.name, type: sel.type } : null, sortEnabled: state.sortEnabled, issuesFilter: state.issuesFilter };
  try {
    await storage.saveAll(fileData, uiState, state.appspace, state.appspaceSubTab);
  } catch (e) { console.warn('Failed to save to IndexedDB:', e); }
}

async function clearStorage() {
  try {
    await storage.clearAll();
  } catch (e) { console.warn('Failed to clear IndexedDB:', e); }
}

// ============================================================================
// FILE LOADING & PARSING
// ============================================================================

async function loadFromStorage() {
  try {
    // Check for preloaded bundle version update
    let storedBundleId = null;
    let uiState = null;
    let appspaceEntry = null;
    let fileData = [];

    if (customConfig.mode === 'strict') {
      storedBundleId = customConfig.bundleId;
      if (customConfig.preloadedFiles && customConfig.preloadedFiles.length > 0) {
        fileData = customConfig.preloadedFiles;
      }
      if (customConfig.preloadedAppspace) {
        appspaceEntry = {
          data: {
            fileName: customConfig.preloadedAppspace.fileName,
            rawContent: customConfig.preloadedAppspace.content
          },
          subTab: 'objects'
        };
      }
      try {
        uiState = await storage.loadUiState();
      } catch (e) {
        console.warn('Failed to load UI state in strict mode:', e);
      }
    } else {
      try {
        storedBundleId = await storage.loadBundleId();
      } catch (e) {
        console.warn('Failed to load bundle ID:', e);
      }
      if (customConfig.bundleId && storedBundleId !== customConfig.bundleId) {
        try {
          await storage.clearAll();
          if (customConfig.preloadedFiles && customConfig.preloadedFiles.length > 0) {
            await storage.saveFiles(customConfig.preloadedFiles);
          }
          if (customConfig.preloadedAppspace) {
            await storage.saveAppspace(
              {
                fileName: customConfig.preloadedAppspace.fileName,
                rawContent: customConfig.preloadedAppspace.content
              },
              'objects'
            );
          }
          await storage.saveBundleId(customConfig.bundleId);
          await storage.saveUiState({
            currentTab: 'overview',
            currentSubTab: 'basic',
            selectedItem: null,
            sortEnabled: 'asc',
            issuesFilter: 'all'
          });
        } catch (e) {
          console.warn('Failed to initialize preloaded database cache:', e);
        }
      }

      try {
        uiState = await storage.loadUiState();
      } catch (e) {
        console.warn('Failed to load UI state:', e);
      }

      let dbAppspaceFailed = false;
      try {
        appspaceEntry = await storage.loadAppspace();
      } catch (e) {
        console.warn('Failed to load appspace from storage:', e);
        dbAppspaceFailed = true;
      }
      if (!appspaceEntry && (dbAppspaceFailed || !storedBundleId)) {
        if (customConfig.preloadedAppspace) {
          appspaceEntry = {
            data: {
              fileName: customConfig.preloadedAppspace.fileName,
              rawContent: customConfig.preloadedAppspace.content
            },
            subTab: 'objects'
          };
        }
      }

      let dbFilesFailed = false;
      try {
        fileData = await storage.loadAllFiles();
      } catch (e) {
        console.warn('Failed to load files from storage:', e);
        dbFilesFailed = true;
      }
      if (!fileData || fileData.length === 0) {
        if (customConfig.preloadedFiles && customConfig.preloadedFiles.length > 0) {
          fileData = customConfig.preloadedFiles;
          // Save preloaded files to IndexedDB for future regular sessions
          try {
            await storage.saveFiles(customConfig.preloadedFiles);
            await storage.saveBundleId(customConfig.bundleId);
          } catch (e) {
            console.warn('Failed to persist preloaded files:', e);
          }
        }
      }
    }

    if (customConfig.title) {
      document.title = customConfig.title;
    }

    if (uiState) {
      state.currentTab = uiState.currentTab || 'modules';
      state.currentSubTab = uiState.currentSubTab || 'basic';
      state.selectedItem = uiState.selectedItem || null;
      state.sortEnabled = uiState.sortEnabled !== undefined ? uiState.sortEnabled : 'asc';
      state.issuesFilter = uiState.issuesFilter || 'all';
      updateSortButton();
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      const activeTabEl = document.querySelector(`.tab[data-tab="${state.currentTab}"]`);
      if (activeTabEl) activeTabEl.classList.add('active');
      const dtTabs = document.getElementById('dataTypeTabs');
      if (dtTabs) dtTabs.style.display = state.currentTab === 'datatypes' ? 'flex' : 'none';
      const appspaceTabs = document.getElementById('appspaceTabs');
      if (appspaceTabs) appspaceTabs.style.display = state.currentTab === 'appspaces' ? 'flex' : 'none';
      const issuesTabs = document.getElementById('issuesTabs');
      if (issuesTabs) issuesTabs.style.display = state.currentTab === 'issues' ? 'flex' : 'none';
      document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
      const subTabEl = document.querySelector(`.subtab[data-subtab="${state.currentSubTab}"]`);
      if (subTabEl) subTabEl.classList.add('active');
      // Restore appspace subtab if on appspaces tab
      if (state.currentTab === 'appspaces') {
        document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
        const appspaceSubtabEl = document.querySelector(`#appspaceTabs .subtab[data-subtab="${state.appspaceSubTab}"]`);
        if (appspaceSubtabEl) appspaceSubtabEl.classList.add('active');
        updateAppspaceTabCount();
      }
      // Restore issues subtab if on issues tab
      if (state.currentTab === 'issues') {
        document.querySelectorAll('#issuesTabs .subtab').forEach(t => t.classList.remove('active'));
        const issuesSubtabEl = document.querySelector(`#issuesTabs .subtab[data-subtab="${state.issuesFilter}"]`);
        if (issuesSubtabEl) issuesSubtabEl.classList.add('active');
      }
    }

    if (appspaceEntry && appspaceEntry.data) {
      state.appspace = appspaceEntry.data;
      state.appspaceSubTab = appspaceEntry.subTab || 'objects';
      const loadBtn = document.getElementById('loadAppspaceBtn');
      const clearBtn = document.getElementById('clearAppspaceBtn');
      const separator = document.getElementById('appspaceSeparator');
      if (customConfig.mode === 'strict') {
        if (loadBtn) loadBtn.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
        if (separator) separator.style.display = 'none';
      } else {
        if (loadBtn) { loadBtn.textContent = 'Change Appspace'; loadBtn.style.display = 'inline-block'; }
        if (clearBtn) clearBtn.style.display = 'inline-block';
        if (separator) separator.style.display = 'block';
      }
      updateAppspaceTabCount();
    }

    if (Array.isArray(fileData) && fileData.length > 0) {
      for (const f of fileData) {
        try {
          const fom = await parseInWorker(f.xml);
          fom.name = f.name;
          fom.xml = f.xml;
          state.files = [...state.files, fom];
        }
        catch (e) { console.error('Failed to parse stored file', f.name, e); }
      }
      if (state.files.length > 0) {
        const sorted = topologicalSort(state.files);
        const dtResult = mergeDataTypes(sorted);
        state.conflicts = state.conflicts.filter(c => c.type !== 'enum' && c.type !== 'variant');
        state.conflicts.push(...dtResult.conflicts);
        state.mergedFOM = { objectClasses: mergeClasses(sorted, 'object'), interactionClasses: mergeClasses(sorted, 'interaction'), dataTypes: dtResult.result, transportations: mergeTransportations(sorted), switches: mergeSwitches(sorted), tags: mergeTags(sorted), time: mergeTime(sorted) };
        reclassifyAppspace();
        detectSubspaceDimensions(); enrichAppspaceApps();
        validate(state, makeIssue); updateUI(); updateTabCounts(); updateIssuesTabVisibility(state);
        if (state.selectedItem) {
          const escapeCss = (s) => s.replace(/"/g, '\\"').replace(/\n/g, '\\n');
          setTimeout(() => {
            const item = document.querySelector(`.tree-item[data-name="${escapeCss(state.selectedItem.name)}"]`);
            if (item) { item.classList.add('selected'); }
            if (state.currentTab === 'modules') {
              const file = state.files.find(f => f.name === state.selectedItem.name);
              if (file) showModuleDetails(file, false);
            } else if (state.currentTab === 'issues') {
              showIssueDetail(state.selectedItem.name);
              issueStore.selectIssue(state.selectedItem.name);
            } else {
              showDetail(state.selectedItem.name, state.selectedItem.type);
            }
          }, 50);
        } else if (state.currentTab !== 'overview') {
          setTimeout(() => {
            const firstItem = document.querySelector('.tree-item');
            if (firstItem) {
              firstItem.classList.add('selected');
              const name = firstItem.dataset.name;
              const issueId = firstItem.dataset.issueId;
              if (state.currentTab === 'issues' && issueId) {
                showIssueDetail(issueId);
                issueStore.selectIssue(issueId);
                return;
              }
              if (state.currentTab === 'issues') return;
              const type = firstItem.dataset.type || (state.currentTab === 'modules' ? null : state.currentTab === 'objects' ? 'object' : state.currentTab === 'dims' ? 'dims' : state.currentTab === 'trans' ? 'trans' : state.currentTab === 'notes' ? 'notes' : state.currentTab === 'switches' ? 'switches' : state.currentTab === 'tags' ? 'tags' : state.currentTab === 'time' ? 'time' : state.currentTab === 'interactions' ? 'interaction' : state.currentSubTab);
              if (name && type) {
                if (state.currentTab === 'modules') {
                  const file = state.files.find(f => f.name === name);
                  if (file) showModuleDetails(file, false);
                } else {
                  showDetail(name, type, true);
                }
              }
            }
          }, 50);
        }
      }
    }
  } catch (e) { console.warn('Failed to load from storage:', e); }
}

class FOMParser {
  constructor(xml) { this.xml = xml; this.parser = new DOMParser(); }

  parse() {
    const doc = this.parser.parseFromString(this.xml, 'text/xml');
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
    return { name, version, dependencies, objectClasses, interactionClasses, dataTypes, modelIdentification, dimensions: dimResult.result, transportations: transResult.result, transportWarnings: transResult.warnings, notes, switches, tags, time, xml: this.xml };
  }

  buildFullName(el, validTagNames) { return buildFullName(el, validTagNames); }
  getSource(doc) { return getSource(doc); }
  parseModelIdentificationFull(modelIdent) { return parseModelIdentificationFull(modelIdent); }
  parseListElements(doc, selector) { return parseListElements(doc, selector); }
  parseDimensions(doc) { return parseDimensions(doc); }
  parseNotes(doc) { return parseNotes(doc); }
  parseTransportations(doc) { return parseTransportations(doc); }
  parseSwitches(doc) { return parseSwitches(doc); }
  parseTags(doc) { return parseTags(doc); }
  parseTime(doc) { return parseTime(doc); }
  parseDependencies(modelIdent) { return parseDependencies(modelIdent); }
  parseObjectClasses(doc) { return parseObjectClasses(doc); }
  parseInteractionClasses(doc) { return parseInteractionClasses(doc); }
  parseDataTypes(doc) { return parseDataTypes(doc); }
}




// ============================================================================
// DATA TYPE UTILITIES
// ============================================================================

function getPreferredType(name) {
  if (!state.mergedFOM) return 'basic';
  if (state.mergedFOM.dataTypes.basic?.find(d => d.name === name)) return 'basic';
  if (state.mergedFOM.dataTypes.simple?.find(d => d.name === name)) return 'simple';
  if (state.mergedFOM.dataTypes.array?.find(d => d.name === name)) return 'array';
  if (state.mergedFOM.dataTypes.fixed?.find(d => d.name === name)) return 'fixed';
  if (state.mergedFOM.dataTypes.enum?.find(d => d.name === name)) return 'enum';
  if (state.mergedFOM.dataTypes.variant?.find(d => d.name === name)) return 'variant';
  return 'basic';
}

function findDimensionByName(dimName) {
  if (!dimName || !state.files) return false;
  const trimmed = dimName.trim();
  for (const f of state.files) {
    if (f.dimensions && f.dimensions.length > 0) {
      const found = f.dimensions.find(d => (d.name || d).trim() === trimmed);
      if (found) return true;
    }
  }
  return false;
}

function notesMatch(notes, noteName) {
  return (notes || '').split(/\s+/).filter(Boolean).includes(noteName);
}

function findNoteUsages(noteName) {
  if (!noteName || !state.mergedFOM) return [];
  const usages = [];
  
  // Check Object classes
  state.mergedFOM.objectClasses?.forEach(obj => {
    if (notesMatch(obj.notes, noteName)) {
      usages.push({ name: obj.name, type: 'object', location: 'Class' });
    }
    obj.attributes?.forEach(attr => {
      if (notesMatch(attr.notes, noteName)) {
        usages.push({ name: obj.name, type: 'object', location: `Attribute: ${attr.name}` });
      }
      if (notesMatch(attr.updateConditionNotes, noteName)) {
        usages.push({ name: obj.name, type: 'object', location: `Update Condition of ${attr.name}` });
      }
    });
  });
  
  // Check Interaction classes
  state.mergedFOM.interactionClasses?.forEach(int => {
    if (notesMatch(int.notes, noteName)) {
      usages.push({ name: int.name, type: 'interaction', location: 'Class' });
    }
    int.parameters?.forEach(param => {
      if (notesMatch(param.notes, noteName)) {
        usages.push({ name: int.name, type: 'interaction', location: `Parameter: ${param.name}` });
      }
    });
  });
  
  // Check Basic data types
  state.mergedFOM.dataTypes?.basic?.forEach(s => {
    if (notesMatch(s.notes, noteName)) {
      usages.push({ name: s.name, type: 'basic', location: 'Basic Data Type' });
    }
  });
  
  // Check Simple data types
  state.mergedFOM.dataTypes?.simple?.forEach(s => {
    if (notesMatch(s.notes, noteName)) {
      usages.push({ name: s.name, type: 'simple', location: 'Simple Data Type' });
    }
    if (notesMatch(s.representationNotes, noteName)) {
      usages.push({ name: s.name, type: 'simple', location: 'Representation of Simple Data Type' });
    }
  });
  
  // Check Array data types
  state.mergedFOM.dataTypes?.array?.forEach(a => {
    if (notesMatch(a.notes, noteName)) {
      usages.push({ name: a.name, type: 'array', location: 'Array Data Type' });
    }
  });
  
  // Check Fixed data types
  state.mergedFOM.dataTypes?.fixed?.forEach(f => {
    if (notesMatch(f.notes, noteName)) {
      usages.push({ name: f.name, type: 'fixed', location: 'Fixed Record Data Type' });
    }
    f.fields?.forEach(field => {
      if (notesMatch(field.notes, noteName)) {
        usages.push({ name: f.name, type: 'fixed', location: `Field: ${field.name}` });
      }
    });
  });
  
  // Check Enumeration data types
  state.mergedFOM.dataTypes?.enum?.forEach(e => {
    if (notesMatch(e.notes, noteName)) {
      usages.push({ name: e.name, type: 'enum', location: 'Enumerated Data Type' });
    }
    if (notesMatch(e.representationNotes, noteName)) {
      usages.push({ name: e.name, type: 'enum', location: 'Representation of Enumerated Data Type' });
    }
    e.values?.forEach(v => {
      if (notesMatch(v.notes, noteName)) {
        usages.push({ name: e.name, type: 'enum', location: `Enumerator: ${v.name}` });
      }
    });
  });
  
  // Check Variant data types
  state.mergedFOM.dataTypes?.variant?.forEach(v => {
    if (notesMatch(v.notes, noteName)) {
      usages.push({ name: v.name, type: 'variant', location: 'Variant Record Data Type' });
    }
    v.alternatives?.forEach(alt => {
      if (notesMatch(alt.notes, noteName)) {
        usages.push({ name: v.name, type: 'variant', location: `Alternative: ${alt.label}` });
      }
    });
  });
  
  // Check Dimensions
  state.files.forEach(f => {
    (f.dimensions || []).forEach(dim => {
      if (notesMatch(dim.notes, noteName)) {
        usages.push({ name: dim.name, type: 'dims', location: 'Dimension' });
      }
    });
  });
  
  return usages;
}

function findDataTypeUsages(typeName) {
  const usages = [];
  if (!state.mergedFOM) return usages;
  
  // Check Object class attributes
  state.mergedFOM.objectClasses?.forEach(obj => {
    obj.attributes?.forEach(attr => {
      if (attr.dataType === typeName) {
        usages.push({ name: obj.name, type: 'object', location: `Attribute: ${attr.name}` });
      }
    });
  });
  
  // Check Interaction class parameters
  state.mergedFOM.interactionClasses?.forEach(int => {
    int.parameters?.forEach(param => {
      if (param.dataType === typeName) {
        usages.push({ name: int.name, type: 'interaction', location: `Parameter: ${param.name}` });
      }
    });
  });
  
  // Check Array data types
  state.mergedFOM.dataTypes.array?.forEach(a => {
    if (a.dataType === typeName) {
      usages.push({ name: a.name, type: 'array', location: 'Array Element Type' });
    }
  });
  
  // Check Fixed record fields
  state.mergedFOM.dataTypes.fixed?.forEach(f => {
    f.fields?.forEach(field => {
      if (field.dataType === typeName) {
        usages.push({ name: f.name, type: 'fixed', location: `Field: ${field.name}` });
      }
    });
  });
  
  // Check Variant record discriminants and alternatives
  state.mergedFOM.dataTypes.variant?.forEach(v => {
    if (v.dataType === typeName) {
      usages.push({ name: v.name, type: 'variant', location: 'Discriminant' });
    }
    v.alternatives?.forEach(alt => {
      if (alt.dataType === typeName) {
        usages.push({ name: v.name, type: 'variant', location: `Alternative: ${alt.label}` });
      }
    });
  });
  
  // Check Simple data types representation
  state.mergedFOM.dataTypes.simple?.forEach(s => {
    if (s.representation === typeName) {
      usages.push({ name: s.name, type: 'simple', location: 'Representation' });
    }
  });
  
  // Check Enumeration representation
  state.mergedFOM.dataTypes.enum?.forEach(e => {
    if (e.representation === typeName) {
      usages.push({ name: e.name, type: 'enum', location: 'Representation' });
    }
  });
  
  // Appspace subspace linkage: if this enum type is referenced by a subspace dimension,
  // show which appspace entries map to it
  if (state.subspaceDimensions && state.subspaceDimensions.length > 0 && state.appspace) {
    const matchingSubspace = state.subspaceDimensions.find(sd => sd.enumName === typeName);
    if (matchingSubspace) {
      const enumNames = new Set(matchingSubspace.enumerators.map(e => e.name));
      (state.appspace.entries || []).forEach(entry => {
        (entry.apps || []).forEach(app => {
          const appStr = typeof app === 'string' ? app : app.name || '';
          if (enumNames.has(appStr)) {
            usages.push({
              name: entry.matchedClass || entry.className,
              type: state.mergedFOM.objectClasses?.some(c => c.name === (entry.matchedClass || entry.className)) ? 'object' : 'interaction',
              location: 'Appspace: ' + appStr
            });
          }
        });
      });
      (state.appspace.interactions || []).forEach(entry => {
        (entry.apps || []).forEach(app => {
          const appStr = typeof app === 'string' ? app : app.name || '';
          if (enumNames.has(appStr)) {
            usages.push({
              name: entry.matchedClass || entry.className,
              type: state.mergedFOM.objectClasses?.some(c => c.name === (entry.matchedClass || entry.className)) ? 'object' : 'interaction',
              location: 'Appspace: ' + appStr
            });
          }
        });
      });
    }
  }
  
  return usages;
}

// ============================================================================
// NAVIGATION (showDetail, showDataType, showModuleDetails)
// ============================================================================

// Map tab names to showDetail()-compatible type values
function tabToType(tab, subTab) {
  const tabMap = {
    'objects': 'object',
    'interactions': 'interaction',
    'dims': 'dims',
    'trans': 'trans',
    'notes': 'notes',
    'switches': 'switches',
    'tags': 'tags',
    'time': 'time',
    'modules': 'ident'
  };
  if (tab === 'datatypes' && subTab) return subTab;
  return tabMap[tab] || tab;
}

// Navigate from issue detail to a specific location
function navigateToLocation(loc) {
  if (!loc || !loc.tab || !loc.itemName) return;
  if (loc.exists === false) return;
  const type = tabToType(loc.tab, loc.subTab);
  showDetail(loc.itemName, type, true);
}

function showDetail(name, type, isManualNav = false) {
  // Save current tab before any changes
  const prevTab = state.currentTab;
  const prevSubTab = state.currentSubTab;
  
  // Switch tab if needed
  const typeToTab = {
    'object': 'objects',
    'interaction': 'interactions',
    'trans': 'trans',
    'dims': 'dims',
    'notes': 'notes',
    'switches': 'switches',
    'tags': 'tags',
    'time': 'time',
    'basic': 'datatypes', 'simple': 'datatypes', 'array': 'datatypes', 'fixed': 'datatypes', 'enum': 'datatypes', 'variant': 'datatypes',
    'appspace_object': 'appspaces', 'appspace_interaction': 'appspaces', 'appspace_unknown': 'appspaces'
  };
  
  const targetTab = typeToTab[type] || type;
  if (targetTab !== state.currentTab) {
    state.currentTab = targetTab;
    if (targetTab !== 'datatypes') {
      state.currentSubTab = null; // Reset when not on datatypes
    }
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabEl = document.querySelector(`.tab[data-tab="${targetTab}"]`);
    if (tabEl) tabEl.classList.add('active');
    if (targetTab === 'datatypes') {
      const dtTabs2 = document.getElementById('dataTypeTabs'); if (dtTabs2) dtTabs2.style.display = 'flex';
      document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
      const subTabEl = document.querySelector(`.subtab[data-subtab="${type}"]`);
      if (subTabEl) subTabEl.classList.add('active');
      state.currentSubTab = type;
    } else {
      const dtTabs2 = document.getElementById('dataTypeTabs'); if (dtTabs2) dtTabs2.style.display = 'none';
    }
    updateUI();
  }
  // Push to history with PREVIOUS tab (only for manual navigation)
  if (isManualNav) {
    // Save what was previously selected if it exists, otherwise save the current item being shown
    let currentSelected;
    if (state.selectedItem) {
      currentSelected = { ...state.selectedItem };
    } else {
      // For first click on a tab with no previous selection, we can't meaningfully go "back"
      // but we still need history for next click - so save current item
      currentSelected = { name, type };
    }
    state.history.push({ tab: prevTab, subTab: prevSubTab, selected: currentSelected, detail: document.getElementById('detailHeader')?.style.display || 'none' });
  }
  // Appspace search result - render the panel first, then set selectedItem
  if (type === 'appspace_object' || type === 'appspace_interaction' || type === 'appspace_unknown') {
    const subTab = type === 'appspace_object' ? 'objects' : type === 'appspace_interaction' ? 'interactions' : 'unknown';
    state.appspaceSubTab = subTab;
    document.getElementById('appspaceTabs').style.display = 'flex';
    document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
    document.querySelector(`#appspaceTabs .subtab[data-subtab="${subTab}"]`)?.classList.add('active');
    updateAppspaceTabCount();
    renderAppspacesPanel();
    state.selectedItem = { name, type };
    const detailHdr3 = document.getElementById('detailHeader');
    if (detailHdr3 && detailHdr3.style.display !== 'block') detailHdr3.style.display = 'block';
    const backBtn3 = document.getElementById('backBtn');
    backBtn3.style.display = state.history.length > 0 ? 'inline-block' : 'none';
    setTimeout(() => {
      const rows = document.querySelectorAll('.appspace-table tr');
      for (const row of rows) {
        if (row.textContent.includes(name)) {
          row.scrollIntoView({ block: 'nearest' });
          break;
        }
      }
    }, 100);
    return;
  }

  state.selectedItem = { name, type };
  
  // Ensure detail panel is visible (tab/subtab click handlers hide it)
  const detailHdr = document.getElementById('detailHeader');
  if (detailHdr && detailHdr.style.display !== 'block') detailHdr.style.display = 'block';
  
  const backBtn = document.getElementById('backBtn');
  backBtn.style.display = state.history.length > 0 ? 'inline-block' : 'none';
  
  
  // Highlight selected item in tree after tree is rebuilt
  const escapeCss = (s) => s.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const highlightItem = () => {
    const allItems = document.querySelectorAll('.tree-item');
    allItems.forEach(i => i.classList.remove('selected'));
    let selector = `.tree-item[data-name="${escapeCss(name)}"][data-type="${type}"]`;
    let selectedItem = document.querySelector(selector);
    if (!selectedItem) {
      selector = `.tree-item[data-name="${escapeCss(name)}"]`;
      selectedItem = document.querySelector(selector);
    }
    if (selectedItem) {
      let parent = selectedItem.parentElement;
      while (parent && !parent.classList.contains('tree-wrapper')) {
        if (parent.classList.contains('tree-children') && parent.classList.contains('collapsed')) {
          parent.classList.remove('collapsed');
          const toggle = parent.previousElementSibling?.querySelector('.tree-toggle');
          if (toggle) { toggle.dataset.expanded = 'true'; toggle.textContent = '▼'; }
        }
        parent = parent.parentElement;
      }
      selectedItem.classList.add('selected');
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  };
  // Run immediately and retry
  highlightItem();
  setTimeout(highlightItem, 200);
  setTimeout(highlightItem, 500);
  
  saveToStorage();
}

// ============================================================================
// MODULE DETAILS
// ============================================================================

// eslint-disable-next-line no-unused-vars
function switchToModule(moduleName, addToHistory = true) {
  const file = state.files.find(f => f.name === moduleName);
  if (file) {
    // Switch to modules tab
    state.currentTab = 'modules';
    state.selectedItem = { name: file.name, type: 'module' };
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const modTab = document.querySelector('.tab[data-tab="modules"]'); if (modTab) modTab.classList.add('active');
    const dtTab = document.getElementById('dataTypeTabs'); if (dtTab) dtTab.style.display = 'none';
    const isTab = document.getElementById('issuesTabs'); if (isTab) isTab.style.display = 'none';
    updateUI();
    showModuleDetails(file, addToHistory);
  }
}

function showModuleDetails(file, addToHistory = true) {
  console.log('[DEBUG-LOOP] showModuleDetails called. file=' + file?.name + ' addToHistory=' + addToHistory);
  const prevTab = state.currentTab;
  const prevSubTab = state.currentSubTab;
  const prevSelected = state.selectedItem || { name: file.name, type: 'module' };
  if (addToHistory) {
    const prevDetail = document.getElementById('detailHeader')?.style.display || 'none';
    state.history.push({ tab: prevTab, subTab: prevSubTab, selected: prevSelected, detail: prevDetail });
  }
  window.__moduleBodyHtml = renderModuleBody(file);
  state.selectedItem = { name: file.name, type: 'module' };
  saveToStorage();
}

function renderModuleBody(file) {
  console.log('[DEBUG-LOOP] renderModuleBody called. file=' + file?.name);
  const sortItems = (items) => state.sortEnabled !== false ? [...items].sort((a, b) => a.name.localeCompare(b.name)) : items;
  const makeLinks = (list, type) => '<ul style="list-style:none;margin:0;padding:0;">' + sortItems(list).map(d => `<li><a href="#" class="clickable-item" onclick="showDataType('${d.name}', '${type}'); return false;">${d.name}</a></li>`).join('') + '</ul>';
  const makeClassLinks = (list, type) => '<ul style="list-style:none;margin:0;padding:0;">' + sortItems(list).map(d => `<li><a href="#" class="clickable-item" onclick="showDetail('${d.name}', '${type}', true); return false;">${d.name}</a></li>`).join('') + '</ul>';
  let modelIdentHtml = '<table class="property-table">';
  if (file.modelIdentification) {
    for (const row of file.modelIdentification) {
      if (row.isSubTable) {
        modelIdentHtml += `<tr><th>${row.key}</th><td><table class="property-table" style="margin:4px 0;border:1px solid #ddd;">`;
        for (const subRow of row.rows) {
          modelIdentHtml += `<tr><th>${subRow.key}</th><td>${subRow.value}</td></tr>`;
        }
        modelIdentHtml += '</table></td></tr>';
      } else if (row.isList) {
        modelIdentHtml += `<tr><th>${row.key}</th><td><ul style="list-style:none;margin:0;padding:0;">${row.values.map(v => '<li>' + v + '</li>').join('')}</ul></td></tr>`;
      } else {
        modelIdentHtml += `<tr><th>${row.key}</th><td>${row.value}</td></tr>`;
      }
    }
  }
  modelIdentHtml += '</table>';
  
  return `<div class="detail-section">
    <h3>Module Information</h3>
    <table class="property-table">
      <tr><th>Name</th><td>${file.name}</td></tr>
      <tr><th>Version</th><td>${file.version}</td></tr>
      <tr><th>Dependencies</th><td>${file.dependencies.length > 0 ? '<ul style="list-style:none;margin:0;padding:0;">' + file.dependencies.map(d => {
        const isLoaded = state.files.some(f => f.name === d);
        return '<li>' + (isLoaded ? '<span class="clickable-item" onclick="switchToModule(\'' + d.replace(/'/g, "\\'") + '\')">' + d + '</span>' : '<span style="color:red;">' + d + '</span>') + '</li>';
      }).join('') + '</ul>' : 'None'}</td></tr>
      <tr><th>Object Classes</th><td>${makeClassLinks(file.objectClasses, 'object')}</td></tr>
      <tr><th>Interaction Classes</th><td>${makeClassLinks(file.interactionClasses, 'interaction')}</td></tr>
      <tr><th>Dimensions</th><td>${file.dimensions && file.dimensions.length > 0 ? (() => { let html = ''; file.dimensions.forEach(d => { const name = d.name || d; if (!name) return; if (d.isComplex) { html += '<div style="margin:4px 0;"><table class="property-table" style="margin:4px 0;border:1px solid #ddd;">';
        d.rows.forEach(r => { 
          let valueHtml = r.value;
          if (r.key === 'dataType' && r.value) {
            const dtType = getPreferredType(r.value);
            if (dtType) {
              valueHtml = '<span class="clickable-item" onclick="showDataType(\'' + r.value.replace(/'/g, "\\'") + '\', \'' + dtType + '\')">' + r.value + '</span>';
            } else {
              valueHtml = '<span style="color:red;">' + r.value + '</span>';
            }
          }
          html += '<tr><th style="white-space:nowrap;">' + r.key + '</th><td>' + valueHtml + '</td></tr>'; 
        }); html += '</table></div>'; } else { html += '<div>' + name + '</div>'; } }); return html; })() : 'None'}</td></tr>
    </table>
    <h4 style="margin:16px 0 8px">Data Types</h4>
    <table class="property-table">
      ${file.dataTypes.basic.length ? `<tr><th>Basic</th><td>${makeLinks(file.dataTypes.basic, 'basic')}</td></tr>` : ''}
      ${file.dataTypes.simple.length ? `<tr><th>Simple</th><td>${makeLinks(file.dataTypes.simple, 'simple')}</td></tr>` : ''}
      ${file.dataTypes.array.length ? `<tr><th>Array</th><td>${makeLinks(file.dataTypes.array, 'array')}</td></tr>` : ''}
      ${file.dataTypes.fixed.length ? `<tr><th>Fixed Record</th><td>${makeLinks(file.dataTypes.fixed, 'fixed')}</td></tr>` : ''}
      ${file.dataTypes.enum.length ? `<tr><th>Enumerated</th><td>${makeLinks(file.dataTypes.enum, 'enum')}</td></tr>` : ''}
      ${file.dataTypes.variant.length ? `<tr><th>Variant Record</th><td>${makeLinks(file.dataTypes.variant, 'variant')}</td></tr>` : ''}
    </table>
    <h4 style="margin:16px 0 8px">Model Identification</h4>
    ${modelIdentHtml}
    ${customConfig.mode === 'strict' ? '' : `<button class="btn btn-danger" style="margin-top:12px" onclick="removeFile(${state.files.indexOf(file)});">Remove Module</button>`}
  </div>`;
}

// ============================================================================
// UI UPDATES
// ============================================================================

function showPanel(panelId) {
  ['treeViewTree', 'treeViewModules', 'treeViewDataTypes', 'treeViewIssues'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === panelId ? '' : 'none';
  });
  const treeControls = document.getElementById('treeControls');
  if (treeControls) treeControls.style.display = panelId ? '' : 'none';
  if (window.__setSortBtnVisible) {
    window.__setSortBtnVisible(panelId && ['treeViewTree', 'treeViewDataTypes', 'treeViewModules'].includes(panelId));
  }
}

function getFirstDisplayedIssue() {
  const CATEGORY_ORDER = ['cross-reference', 'load-conflict', 'validation', 'circular-dependency'];
  for (const cat of CATEGORY_ORDER) {
    const issue = state.issues.find(i => i.category === cat);
    if (issue) return issue;
  }
  return state.issues[0];
}

function updateUI(skipAutoSelect) {
  console.log('[DEBUG-LOOP] updateUI called. skipAutoSelect=' + skipAutoSelect + ' tab=' + state.currentTab + ' selectedItem=' + JSON.stringify(state.selectedItem));
  updateTabCounts();
  updateTabScrollButtons();
  const treeView = document.getElementById('treeView');
  const exportBtn = document.getElementById('exportBtn');
  const backBtn = document.getElementById('backBtn');
  const hasData = state.files.length > 0;
  exportBtn.style.display = hasData ? 'inline-block' : 'none';
  backBtn.style.display = state.history.length > 0 ? 'inline-block' : 'none';

  // Overview tab shows the dashboard, hides sidebar tree
  if (state.currentTab === 'overview') {
    showPanel(null);
    const dh = document.getElementById('detailHeader'); if (dh) dh.style.display = 'none';
    const ws = document.getElementById('welcomeScreen'); if (ws) ws.style.display = '';
    return;
  }

  // Hide sidebar for Appspaces tab (uses main panel, not sidebar)
  if (state.currentTab === 'appspaces') {
    showPanel(null);
    const dh = document.getElementById('detailHeader'); if (dh) dh.style.display = 'block';
    const ws = document.getElementById('welcomeScreen'); if (ws) ws.style.display = 'none';
    renderAppspacesPanel();
    state.selectedItem = { name: 'Appspaces', type: 'appspace' };
    return;
  }

  if (hasData && state.currentTab !== 'overview') {
    const ws = document.getElementById('welcomeScreen');
    if (ws) ws.style.display = 'none';
  }

  if (!state.mergedFOM && state.currentTab !== 'modules' && state.currentTab !== 'overview') {
    showPanel(null);
    return;
  }

  const sel = state.selectedItem;

  if (state.currentTab === 'modules') {
    showPanel('treeViewModules');
    const sortedFiles = state.sortEnabled === 'asc' ? [...state.files].sort((a, b) => a.name.localeCompare(b.name)) : state.sortEnabled === 'desc' ? [...state.files].sort((a, b) => b.name.localeCompare(a.name)) : state.files;
    window.__moduleListComponent?.setFiles(sortedFiles, state.sortEnabled);
    if (!sel && !skipAutoSelect && sortedFiles.length > 0) {
      const file = state.files.find(f => f.name === sortedFiles[0].name);
      if (file) {
        showModuleDetails(file, true);
        window.__moduleListComponent?.setSelected(file.name);
      }
    } else if (sel && sel.name) {
      window.__moduleListComponent?.setSelected(sel.name);
    }
  } else if (state.currentTab === 'objects') {
    showPanel('treeViewTree');
    const classes = mergeClasses(state.files, 'object');
    const sorted = state.sortEnabled === 'asc' ? [...classes].sort((a, b) => a.name.localeCompare(b.name)) : state.sortEnabled === 'desc' ? [...classes].sort((a, b) => b.name.localeCompare(a.name)) : classes;
    sorted.forEach(c => { c.usageCount = findDataTypeUsages(c.name).length; });
    window.__treeViewComponent?.setItems(sorted, 'tree');
    if (!sel && !skipAutoSelect && classes.length > 0) {
      showDetail(classes[0].name, 'object', true);
      window.__treeViewComponent?.setSelected(classes[0].name);
    } else if (sel && sel.name) {
      window.__treeViewComponent?.setSelected(sel.name);
    }
  } else if (state.currentTab === 'interactions') {
    showPanel('treeViewTree');
    const classes = mergeClasses(state.files, 'interaction');
    const sorted = state.sortEnabled === 'asc' ? [...classes].sort((a, b) => a.name.localeCompare(b.name)) : state.sortEnabled === 'desc' ? [...classes].sort((a, b) => b.name.localeCompare(a.name)) : classes;
    sorted.forEach(c => { c.usageCount = findDataTypeUsages(c.name).length; });
    window.__treeViewComponent?.setItems(sorted, 'tree');
    if (!sel && !skipAutoSelect && classes.length > 0) {
      showDetail(classes[0].name, 'interaction', true);
      window.__treeViewComponent?.setSelected(classes[0].name);
    } else if (sel && sel.name) {
      window.__treeViewComponent?.setSelected(sel.name);
    }
  } else if (state.currentTab === 'dims') {
    showPanel('treeViewTree');
    let allDims = [];
    state.files.forEach(f => { if (f.dimensions) f.dimensions.forEach(d => { const n = d.name || d; allDims.push({ name: n, icon: '📐', fullName: n, usageCount: findDataTypeUsages(n).length }); }); });
    if (state.sortEnabled === 'asc') allDims.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sortEnabled === 'desc') allDims.sort((a, b) => b.name.localeCompare(a.name));
    window.__treeViewComponent?.setItems(allDims, 'flat');
    if (!sel && !skipAutoSelect && allDims.length > 0) {
      showDetail(allDims[0].name, 'dims');
      window.__treeViewComponent?.setSelected(allDims[0].name);
    } else if (sel && sel.name) {
      window.__treeViewComponent?.setSelected(sel.name);
    }
  } else if (state.currentTab === 'trans') {
    showPanel('treeViewTree');
    const list = state.mergedFOM?.transportations || [];
    let items = list.map(t => ({ name: t.name, icon: '🚚', usageCount: findDataTypeUsages(t.name).length }));
    if (state.sortEnabled === 'asc') items.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sortEnabled === 'desc') items.sort((a, b) => b.name.localeCompare(a.name));
    window.__treeViewComponent?.setItems(items, 'flat');
    if (!sel && !skipAutoSelect && items.length > 0) {
      showDetail(items[0].name, 'trans');
      window.__treeViewComponent?.setSelected(items[0].name);
    } else if (sel && sel.name) {
      window.__treeViewComponent?.setSelected(sel.name);
    }
  } else if (state.currentTab === 'notes') {
    showPanel('treeViewTree');
    let allNotes = [];
    state.files.forEach(f => { if (f.notes) f.notes.forEach(n => { const name = typeof n === 'string' ? n : (n.name || 'Note'); allNotes.push({ name, icon: '📝' }); }); });
    const noteSort = (a, b) => { const r = /^(.*?)(\d+)$/; const ma = a.name.match(r), mb = b.name.match(r); if (ma && mb && ma[1] === mb[1]) return parseInt(ma[2]) - parseInt(mb[2]); return a.name.localeCompare(b.name); };
    if (state.sortEnabled === 'asc') allNotes.sort(noteSort);
    else if (state.sortEnabled === 'desc') allNotes.sort((a, b) => noteSort(b, a));
    window.__treeViewComponent?.setItems(allNotes, 'flat');
    if (!sel && !skipAutoSelect && allNotes.length > 0) {
      showDetail(allNotes[0].name, 'notes', true);
      window.__treeViewComponent?.setSelected(allNotes[0].name);
    } else if (sel && sel.name) {
      window.__treeViewComponent?.setSelected(sel.name);
    }
  } else if (state.currentTab === 'switches') {
    showPanel('treeViewTree');
    const list = state.mergedFOM?.switches || [];
    let items = list.map(s => ({ name: s.name, icon: '🔘', usageCount: findDataTypeUsages(s.name).length }));
    if (state.sortEnabled === 'asc') items.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sortEnabled === 'desc') items.sort((a, b) => b.name.localeCompare(a.name));
    window.__treeViewComponent?.setItems(items, 'flat');
    if (!sel && !skipAutoSelect && items.length > 0) {
      showDetail(items[0].name, 'switches');
      window.__treeViewComponent?.setSelected(items[0].name);
    } else if (sel && sel.name) {
      window.__treeViewComponent?.setSelected(sel.name);
    }
  } else if (state.currentTab === 'tags') {
    showPanel('treeViewTree');
    const list = state.mergedFOM?.tags || [];
    let items = list.map(t => ({ name: t.name, icon: '🏷️', usageCount: findDataTypeUsages(t.name).length }));
    if (state.sortEnabled === 'asc') items.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sortEnabled === 'desc') items.sort((a, b) => b.name.localeCompare(a.name));
    window.__treeViewComponent?.setItems(items, 'flat');
    if (!sel && !skipAutoSelect && items.length > 0) {
      showDetail(items[0].name, 'tags');
      window.__treeViewComponent?.setSelected(items[0].name);
    } else if (sel && sel.name) {
      window.__treeViewComponent?.setSelected(sel.name);
    }
  } else if (state.currentTab === 'time') {
    showPanel('treeViewTree');
    const items = state.mergedFOM?.time ? [{ name: 'time', icon: '⏱️' }] : [];
    window.__treeViewComponent?.setItems(items, 'flat');
    if (!sel && !skipAutoSelect && items.length > 0) {
      showDetail('time', 'time');
      window.__treeViewComponent?.setSelected('time');
    } else if (sel && sel.name) {
      window.__treeViewComponent?.setSelected(sel.name);
    }
  } else if (state.currentTab === 'issues') {
    showPanel('treeViewIssues');
    if (!sel && !skipAutoSelect && state.issues.length > 0) {
      const first = getFirstDisplayedIssue();
      showIssueDetail(first.id);
      issueStore.selectIssue(first.id);
    }
  } else {
    showPanel('treeViewDataTypes');
    const items = state.mergedFOM?.dataTypes[state.currentSubTab] || [];
    const sortedItems = state.sortEnabled === 'asc' ? [...items].sort((a, b) => a.name.localeCompare(b.name)) : state.sortEnabled === 'desc' ? [...items].sort((a, b) => b.name.localeCompare(a.name)) : items;
    window.__dataTypeListComponent?.setItems(items, state.currentSubTab, state.sortEnabled);
    if (!sel && !skipAutoSelect && sortedItems.length > 0) {
      showDetail(sortedItems[0].name, state.currentSubTab);
      window.__dataTypeListComponent?.setSelected(sortedItems[0].name);
    } else if (sel && sel.name) {
      window.__dataTypeListComponent?.setSelected(sel.name);
    }
  }
}
function updateTabCounts() {
  // Tab counts handled reactively by LeftRail.svelte and FilterChips.svelte via fomStore
}

async function loadFiles(files) {
  if (customConfig.mode === 'strict') {
    showToast('Loading files is disabled in strict mode');
    return;
  }
  state.issues = [];
  const totalFiles = files.length;
  let failedFiles = 0;
  const parseErrors = [];
  for (const file of files) {
    try {
      const text = await file.text();
      const fom = await parseInWorker(text);
      state.files = [...state.files, fom];
      await addRecentFile(file.name, {
        objects: fom.objectClasses?.length || 0,
        interactions: fom.interactionClasses?.length || 0,
        dataTypes: Object.values(fom.dataTypes || {}).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0)
      });
    } catch (e) {
      failedFiles++;
      parseErrors.push({ name: file.name, message: e.message });
    }
  }
  if (state.files.length > 0) {
    const sorted = topologicalSort(state.files);
    const dtResult = mergeDataTypes(sorted);
    state.conflicts = state.conflicts.filter(c => c.type !== 'enum' && c.type !== 'variant');
    state.conflicts.push(...dtResult.conflicts);
    state.mergedFOM = {
      objectClasses: mergeClasses(sorted, 'object'),
      interactionClasses: mergeClasses(sorted, 'interaction'),
      dataTypes: dtResult.result,
      transportations: mergeTransportations(sorted),
      switches: mergeSwitches(sorted),
      tags: mergeTags(sorted),
      time: mergeTime(sorted)
    };
    detectSubspaceDimensions(); reclassifyAppspace(); enrichAppspaceApps();
    state.history = [];
    state.currentTab = 'modules';
    document.getElementById('globalSearch').value = '';
    hideSearchPanel();
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const modTab2 = document.querySelector('.tab[data-tab="modules"]'); if (modTab2) modTab2.classList.add('active');
    const dtTab2 = document.getElementById('dataTypeTabs'); if (dtTab2) dtTab2.style.display = 'none';
    const isTab2 = document.getElementById('issuesTabs'); if (isTab2) isTab2.style.display = 'none';
    // Run validate() first (it resets state.issues), then append parse errors
    validate(state, makeIssue);
    parseErrors.forEach(pe => {
      state.issues.push(makeIssue('error', 'validation', 'parse-error',
        `Failed to parse ${pe.name}`,
        pe.message,
        [pe.name],
      ));
    });
    updateIssuesTabVisibility(state);
    generateAppspaceWarnings(state, makeIssue);
    state.selectedItem = null;
    saveToStorage();
    updateUI();
    if (failedFiles > 0) {
      showToast(`Loaded ${totalFiles - failedFiles} files (${failedFiles} failed)`);
    } else {
      showToast(`Loaded ${totalFiles} files`);
    }
  } else {
    validate(state, makeIssue);
    parseErrors.forEach(pe => {
      state.issues.push(makeIssue('error', 'validation', 'parse-error',
        `Failed to parse ${pe.name}`,
        pe.message,
        [pe.name],
      ));
    });
    updateIssuesTabVisibility(state);
    generateAppspaceWarnings(state, makeIssue);
    saveToStorage();
    updateUI();
    if (failedFiles > 0) {
      showToast(`0 files loaded (${failedFiles} failed)`);
    }
  }
}

// ============================================================================
// FILE MANAGEMENT
// ============================================================================

// eslint-disable-next-line no-unused-vars
function removeFile(index) {
  if (customConfig.mode === 'strict') {
    return;
  }
  const dh = document.getElementById('detailHeader'); if (dh) dh.style.display = 'none';
  state.files.splice(index, 1);
  if (state.files.length > 0) { 
    const sorted = topologicalSort(state.files); 
    const dtResult = mergeDataTypes(sorted);
    state.conflicts = state.conflicts.filter(c => c.type !== 'enum' && c.type !== 'variant');
    state.conflicts.push(...dtResult.conflicts);
    state.mergedFOM = { objectClasses: mergeClasses(sorted, 'object'), interactionClasses: mergeClasses(sorted, 'interaction'), dataTypes: dtResult.result, transportations: mergeTransportations(sorted), switches: mergeSwitches(sorted), tags: mergeTags(sorted), time: mergeTime(sorted) };
    reclassifyAppspace();
    detectSubspaceDimensions(); enrichAppspaceApps();
  }
  else {
    state.mergedFOM = null;
    state.subspaceDimensions = [];
    if (state.appspace && state.appspace.rawContent) {
      const entries = parseAppspaceFile(state.appspace.rawContent);
      state.appspace.entries = [];
      state.appspace.interactions = [];
      state.appspace.unknown = entries;
      updateAppspaceTabCount();
    }
  }
  saveToStorage(); validate(state, makeIssue); updateUI(); updateIssuesTabVisibility(state);
}

document.getElementById('fileInput')?.addEventListener('change', e => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    loadFiles(files);
    e.target.value = '';
  }
});

function updateSortButton() {
  const btn = document.getElementById('sortBtn');
  if (!btn) return;
  if (state.sortEnabled === false) {
    btn.textContent = 'Sort: Off';
    btn.style.opacity = '0.5';
  } else if (state.sortEnabled === 'asc') {
    btn.textContent = 'Sort: A→Z';
    btn.style.opacity = '1';
  } else {
    btn.textContent = 'Sort: Z→A';
    btn.style.opacity = '1';
  }
}

document.getElementById('sortBtn')?.addEventListener('click', () => {
  if (state.sortEnabled === 'asc') state.sortEnabled = 'desc';
  else if (state.sortEnabled === 'desc') state.sortEnabled = false;
  else state.sortEnabled = 'asc';
  saveToStorage();
  updateSortButton();
  updateUI();
});

document.getElementById('exportBtn')?.addEventListener('click', () => {
  const btn = document.getElementById('exportBtn');
  const existing = document.getElementById('exportMenu');
  if (existing) { existing.remove(); return; }
  const menu = document.createElement('div');
  menu.id = 'exportMenu';
  menu.style.cssText = 'position:absolute;top:100%;right:0;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:100;min-width:180px;';
  const items = [
    { label: 'Print / PDF', action: () => exportPrint() },
    { label: 'Export JSON (summary)', action: () => exportJSON(state) },
    { label: 'Export JSON (full)', action: () => exportFullJSON(state) },
    { label: 'Export CSV (current view)', action: () => exportCSV(state, state.currentTab, state.currentSubTab) },
  ];
  items.forEach((item, i) => {
    const el = document.createElement('div');
    el.textContent = item.label;
    el.style.cssText = 'padding:8px 16px;cursor:pointer;font-size:13px;white-space:nowrap;';
    el.addEventListener('mouseenter', () => el.style.background = 'var(--bg-hover)');
    el.addEventListener('mouseleave', () => el.style.background = '');
    el.addEventListener('click', (e) => { e.stopPropagation(); item.action(); menu.remove(); });
    menu.appendChild(el);
    if (i < items.length - 1) {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:var(--border);margin:2px 0;';
      menu.appendChild(sep);
    }
  });
  btn.style.position = 'relative';
  btn.appendChild(menu);
  const close = (e) => { if (!menu.contains(e.target) && e.target !== btn) menu.remove(); };
  setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const prevDetailShowing = (document.getElementById('detailHeader')?.style.display || 'none') !== 'none';
    const prevTab = state.currentTab;
    const prevSubTab = state.currentSubTab;
    const prevSelected = state.selectedItem;

    if (state.currentTab !== tab.dataset.tab) { 
      // Always preserve tab state when leaving a tab with subtabs (datatypes, issues, appspaces)
      // so back-button restores the correct subtab even when detail panel is hidden
      if (prevDetailShowing || ['issues', 'appspaces', 'datatypes'].includes(prevTab)) {
        debugBack('tab click: prevTab=%s, prevSelected=%s, prevDetailShowing=%s', prevTab, prevSelected ? prevSelected.name + '/' + prevSelected.type : 'null', prevDetailShowing);
        const historySubTab = prevTab === 'appspaces' ? state.appspaceSubTab : prevTab === 'issues' ? state.issuesFilter : prevSubTab;
        state.history.push({ tab: prevTab, subTab: historySubTab, selected: prevSelected, detail: 'block' });
      }
    }
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); state.currentTab = tab.dataset.tab; state.selectedItem = null;
    const dtTabs = document.getElementById('dataTypeTabs'); if (dtTabs) dtTabs.style.display = state.currentTab === 'datatypes' ? 'flex' : 'none';
    const appspaceTabs = document.getElementById('appspaceTabs'); if (appspaceTabs) appspaceTabs.style.display = state.currentTab === 'appspaces' ? 'flex' : 'none';
    const issuesTabs = document.getElementById('issuesTabs'); if (issuesTabs) issuesTabs.style.display = state.currentTab === 'issues' ? 'flex' : 'none';
    // Handle Data Types tab - ensure a subtab is selected BEFORE updateUI
    if (state.currentTab === 'datatypes') {
      const validSubTabs = ['basic', 'simple', 'array', 'fixed', 'enum', 'variant'];
      if (!state.currentSubTab || !validSubTabs.includes(state.currentSubTab)) {
        state.currentSubTab = 'basic';
      }
      document.querySelectorAll('#dataTypeTabs .subtab').forEach(t => t.classList.remove('active'));
      const activeSubtab = document.querySelector(`#dataTypeTabs .subtab[data-subtab="${state.currentSubTab}"]`);
      if (activeSubtab) activeSubtab.classList.add('active');
    }
    
    // Handle Issues tab - ensure a subtab is selected BEFORE updateUI
    if (state.currentTab === 'issues') {
      const validFilters = ['all', 'error', 'warning'];
      if (!state.issuesFilter || !validFilters.includes(state.issuesFilter)) {
        state.issuesFilter = 'all';
      }
      document.querySelectorAll('#issuesTabs .subtab').forEach(t => t.classList.remove('active'));
      const activeSubtab = document.querySelector(`#issuesTabs .subtab[data-subtab="${state.issuesFilter}"]`);
      if (activeSubtab) activeSubtab.classList.add('active');
    }
    
    updateUI(); saveToStorage();
    
    // When switching from overview to any other tab, Svelte needs to create
    // the {:else} DOM before showPanel can find tree panels. Re-run after render.
    requestAnimationFrame(() => {
      if (state.currentTab !== 'overview') updateUI();
    });
    
    // Handle Overview tab
    if (state.currentTab === 'overview') {
      const dh = document.getElementById('detailHeader'); if (dh) dh.style.display = 'none';
      updateUI(); saveToStorage();
      return;
    }

    // Handle Appspaces tab
    if (state.currentTab === 'appspaces') {
      // Ensure a subtab is selected
      if (!state.appspaceSubTab) state.appspaceSubTab = 'objects';
      document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
      const activeSubtab = document.querySelector(`#appspaceTabs .subtab[data-subtab="${state.appspaceSubTab}"]`);
      if (activeSubtab) activeSubtab.classList.add('active');
      updateAppspaceTabCount();
      renderAppspacesPanel();
      state.selectedItem = { name: 'Appspaces', type: 'appspace' };
      return;
    }
  });
});

// Data type subtab click handler (document-level delegation — survives Svelte re-renders)
document.addEventListener('click', (e) => {
  const tab = e.target.closest('#dataTypeTabs .subtab');
  if (!tab) return;
  const prevDetailShowing = (document.getElementById('detailHeader')?.style.display || 'none') !== 'none';
  const prevTab = state.currentTab;
  const prevSubTab = state.currentSubTab;
  const prevSelected = state.selectedItem;
  
  if (state.currentSubTab !== tab.dataset.subtab) { 
    if (prevDetailShowing) {
      state.history.push({ tab: prevTab, subTab: prevSubTab, selected: prevSelected, detail: 'block' });
    }
  }
  document.querySelectorAll('#dataTypeTabs .subtab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); state.currentSubTab = tab.dataset.subtab;
  state.selectedItem = null;
  updateUI(); saveToStorage();
});

// Appspace subtab click handler (document-level delegation)
document.addEventListener('click', (e) => {
  const tab = e.target.closest('#appspaceTabs .subtab');
  if (!tab) return;
  const prevDetailShowing = (document.getElementById('detailHeader')?.style.display || 'none') !== 'none';
  const prevSubTab = state.appspaceSubTab;
  const prevSelected = state.selectedItem;

  if (state.appspaceSubTab !== tab.dataset.subtab) { 
    if (prevDetailShowing) {
      state.history.push({ tab: 'appspaces', subTab: prevSubTab, selected: prevSelected, detail: 'block' });
    }
  }
  document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
  state.appspaceSubTab = tab.dataset.subtab;
  state.selectedItem = null;
  saveAppspaceToStorage();
  updateUI();
  renderAppspacesPanel();
});

// Issues subtab click handler (document-level delegation — survives Svelte re-renders)
document.addEventListener('click', (e) => {
  const tab = e.target.closest('#issuesTabs .subtab');
  if (!tab) return;
  // Push to history when switching subtab
  const prevSubTab = state.issuesFilter;
  const prevSelected = state.selectedItem;

  document.querySelectorAll('#issuesTabs .subtab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  state.issuesFilter = tab.dataset.subtab;

  if (prevSubTab !== tab.dataset.subtab) {
    state.history.push({ tab: 'issues', subTab: prevSubTab, selected: prevSelected, detail: 'block' });
  }

  state.selectedItem = null;
  const header = document.getElementById('detailHeader');
  const welcome = document.getElementById('welcomeScreen');
  const body = document.getElementById('detailBody');
  if (state.files && state.files.length > 0) {
    // Files loaded: hide header and welcome screen
    if (header) header.style.display = 'none';
    if (welcome) welcome.style.display = 'none';

    // Count issues matching the current filter
    let filteredCount = 0;
    if (state.issues && state.issues.length > 0) {
      if (state.issuesFilter === 'error') {
        filteredCount = state.issues.filter(i => i.severity === 'error').length;
      } else if (state.issuesFilter === 'warning') {
        filteredCount = state.issues.filter(i => i.severity === 'warning').length;
      } else {
        filteredCount = state.issues.length;
      }
    }

    // Only show empty-state when zero issues match the filter;
    // updateUI() will fill the detail body when there are matches.
    if (body && filteredCount === 0) {
      let msg = 'No issues found.';
      if (state.issuesFilter === 'error') msg = 'No errors found.';
      else if (state.issuesFilter === 'warning') msg = 'No warnings found.';
      body.textContent = '';
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = msg;
      body.appendChild(emptyState);
    }
  } else {
    // No files loaded: show welcome screen
    if (header) header.style.display = 'none';
    if (welcome) welcome.style.display = 'flex';
  }
  updateUI();
  saveToStorage();
});

// Render Appspaces panel
function renderAppspacesPanel() {
  const body = document.getElementById('detailBody');
  const header = document.getElementById('detailHeader');
  const title = document.getElementById('detailTitle');
  const meta = document.getElementById('detailMeta');
  const welcome = document.getElementById('welcomeScreen');

  if (!state.appspace) {
    if (welcome) welcome.style.display = 'none';
    if (header) header.style.display = 'block';
    if (meta) meta.textContent = '';
    window.__appspaceBodyHtml = `
      <div class="empty-state" style="max-width:500px;margin:40px auto;text-align:center;line-height:1.6;">
        <p style="margin-bottom:12px;font-size:15px;">
          Appspaces let you classify object and interaction classes across FOM modules
          by assigning them to application spaces. This helps visualize which classes
          belong to which application domains.
        </p>
        <p style="margin-bottom:20px;font-size:14px;color:var(--text-secondary);">
          To get started, load an appspace file (.appspace, .csv, or .txt).
        </p>
        <button class="btn" onclick="document.getElementById('loadAppspaceBtn').click()">
          Load Appspace
        </button>
      </div>`;
    return;
  }

  if (welcome) welcome.style.display = 'none';
  if (header) header.style.display = 'block';

  const subTab = state.appspaceSubTab;
  let entries = [];
  let clickType = 'object';

  if (subTab === 'objects') {
    entries = state.appspace.entries || [];
    clickType = 'object';
  } else if (subTab === 'interactions') {
    entries = state.appspace.interactions || [];
    clickType = 'interaction';
  } else if (subTab === 'unknown') {
    entries = state.appspace.unknown || [];
  }

  let q = searchStore.searchState.query ? searchStore.searchState.query.toLowerCase() : '';

  function markText(text) {
    if (!q || !text) return escapeHtml(text);
    const lower = text.toLowerCase();
    let result = '';
    let last = 0;
    let idx = lower.indexOf(q);
    while (idx !== -1) {
      result += escapeHtml(text.slice(last, idx)) + '<mark class="highlight">' + escapeHtml(text.slice(idx, idx + q.length)) + '</mark>';
      last = idx + q.length;
      idx = lower.indexOf(q, last);
    }
    result += escapeHtml(text.slice(last));
    return result;
  }

  let html = '';

  if (entries.length === 0) {
    if (subTab === 'unknown') {
      html = '<div class="empty-state">All appspace entries are matched to known classes.</div>';
    } else {
      html = '<div class="empty-state">No matched ' + subTab + ' found.</div>';
    }
  } else {
    // Sort entries based on state.sortEnabled
    const sortedEntries = [...entries];
    if (state.sortEnabled === 'asc') {
      sortedEntries.sort((a, b) => a.className.localeCompare(b.className));
    } else if (state.sortEnabled === 'desc') {
      sortedEntries.sort((a, b) => b.className.localeCompare(a.className));
    }

    html += '<table class="appspace-table">';
    html += '<tr><th>Class</th><th>Appspace(s)</th></tr>';
    sortedEntries.forEach(entry => {
      const fullClassName = entry.matchedClass || entry.className;
      const displayName = entry.className;
      const displayParts = displayName.split('.');
      const isUnknown = subTab === 'unknown';
      html += `<tr ${isUnknown ? 'class="unmatched"' : ''}>`;
      html += '<td>';
      displayParts.forEach((part, idx) => {
        const isLeaf = idx === displayParts.length - 1;
        if (idx > 0) html += '<span class="tree-part">.</span>';
        if (isUnknown) {
          html += `<span class="tree-part leaf">${markText(part)}</span>`;
        } else if (isLeaf) {
          html += `<span class="tree-part leaf appspace-link" onclick="showDetail('${fullClassName}', '${clickType}', true)">${markText(part)}</span>`;
        } else {
          html += `<span class="tree-part parent">${markText(part)}</span>`;
        }
      });
      html += '</td><td><ul class="apps-list">';
      entry.apps.forEach(app => {
        const appStr = typeof app === 'string' ? app : app.name || '';
        const subspaceMatches = (entry._subspace || []).filter(m => m.appName === appStr);
        html += '<li class="app-item">';
        if (subspaceMatches.length > 0) {
          const firstMatch = subspaceMatches[0];
          const escEnum = firstMatch.enumName.replace(/'/g, "\\'");
          const escApp = appStr.replace(/'/g, "\\'");
          html += `<span class="app-name appspace-link" onclick="showDataType('${escEnum}', 'enum'); window.__setVariantHighlight && window.__setVariantHighlight('${escEnum}', '${escApp}')">${markText(appStr)}</span>`;
        } else {
          html += `<span class="app-name unmatched">${markText(appStr)}</span>`;
        }
        if (subspaceMatches.length > 0) {
          html += '<span class="subspace-tags">';
          subspaceMatches.forEach(m => {
            const escEnum = m.enumName.replace(/'/g, "\\'");
            const escDim = m.dimensionName.replace(/'/g, "\\'");
            html += `<span class="subspace-tag" onclick="showDataType('${escEnum}', 'enum')" title="Dimension: ${escDim}, Enum value: ${m.enumeratorValue !== undefined ? m.enumeratorValue : ''}">${m.dimensionName}</span>`;
          });
          html += '</span>';
        }
        html += '</li>';
      });
      html += '</ul></td></tr>';
    });
    html += '</table>';
  }

  window.__appspaceBodyHtml = html;

  // Scroll to selected appspace entry if navigated
  if (state.selectedItem && state.selectedItem.type && state.selectedItem.type.startsWith('appspace_')) {
    const selectedName = state.selectedItem.name;
    setTimeout(() => {
      const rows = document.querySelectorAll('.appspace-table tr');
      for (const row of rows) {
        if (row.textContent.includes(selectedName)) {
          row.scrollIntoView({ block: 'nearest' });
          break;
        }
      }
    }, 100);
  }
}

// Find a class in the list using right-side matching (like findAppspaceForClass does)
function findClassByRightSideMatch(entryName, classList) {
  let bestMatch = null;
  let bestLength = 0;

  classList.forEach(cls => {
    const entryParts = entryName.split('.');
    const classParts = cls.name.split('.');

    // Check if entry matches the right side of className
    if (classParts.length >= entryParts.length) {
      const startIdx = classParts.length - entryParts.length;
      let matches = true;
      for (let i = 0; i < entryParts.length; i++) {
        if (classParts[startIdx + i] !== entryParts[i]) {
          matches = false;
          break;
        }
      }
      if (matches && entryParts.length > bestLength) {
        bestMatch = cls;
        bestLength = entryParts.length;
      }
    }
  });

  return bestMatch;
}

function makeSnippet(item, type) {
  if (!item) return '';
  if (type === 'object') {
    const parts = [];
    if (item.parent) parts.push('Parent: ' + item.parent);
    if (item.attributes && item.attributes.length) parts.push(item.attributes.length + ' attribute(s)');
    return parts.join(' | ');
  }
  if (type === 'interaction') {
    const parts = [];
    if (item.parent) parts.push('Parent: ' + item.parent);
    if (item.parameters && item.parameters.length) parts.push(item.parameters.length + ' parameter(s)');
    return parts.join(' | ');
  }
  if (type === 'basic') return 'Size: ' + (item.size || '?') + (item.encoding ? ' — ' + item.encoding.substring(0, 80) : '');
  if (type === 'simple') return 'Representation: ' + (item.representation || '?') + (item.units ? ' | Units: ' + item.units : '');
  if (type === 'array') return 'Type: ' + (item.type || '?') + (item.cardinality ? ' | Cardinality: ' + item.cardinality : '');
  if (type === 'fixed') return (item.fields && item.fields.length ? item.fields.length + ' field(s)' : '');
  if (type === 'enum') return (item.values && item.values.length ? item.values.length + ' enumerator(s)' : '') + (item.representation ? ' | Repr: ' + item.representation : '');
  if (type === 'variant') return (item.discriminant ? 'Discriminant: ' + item.discriminant : '') + (item.alternatives && item.alternatives.length ? ' | ' + item.alternatives.length + ' alternative(s)' : '');
  if (type === 'trans') return 'Type: ' + (item.transportationType || item.kind || '?');
  if (type === 'switches') return (item.values && item.values.length ? item.values.length + ' value(s)' : '');
  if (type === 'tags') return 'Tag: ' + (item.tagValue || '');
  if (type === 'dims') return 'Type: ' + (item.dataType || '?') + (item.units ? ' | Units: ' + item.units : '');
  if (type === 'notes') {
    const text = typeof item === 'string' ? item : item.text || '';
    return text ? text.substring(0, 120) : '';
  }
  if (type === 'appspace_object' || type === 'appspace_interaction' || type === 'appspace_unknown') {
    const parts = [];
    if (item.matchedClass) parts.push('Class: ' + item.matchedClass);
    if (item.apps && item.apps.length) parts.push(item.apps.length + ' app(s)');
    if (item._subspace && item._subspace.length > 0) {
      const dims = [...new Set(item._subspace.map(m => m.dimensionName))];
      parts.push('Subspace: ' + dims.join(', '));
    }
    return parts.join(' | ');
  }
  return '';
}

function performSearch(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const allItems = [];

  if (state.mergedFOM) {
    state.mergedFOM.objectClasses?.forEach(c => {
      allItems.push({ name: c.name, type: 'object', snippet: makeSnippet(c, 'object') });
      c.attributes?.forEach(a => {
        allItems.push({ name: a.name, type: 'attribute', parentName: c.name, parentType: 'object', snippet: 'Class: ' + c.name + (a.dataType ? ' | Type: ' + a.dataType : '') });
      });
    });
    state.mergedFOM.interactionClasses?.forEach(c => {
      allItems.push({ name: c.name, type: 'interaction', snippet: makeSnippet(c, 'interaction') });
      c.parameters?.forEach(p => {
        allItems.push({ name: p.name, type: 'parameter', parentName: c.name, parentType: 'interaction', snippet: 'Class: ' + c.name + (p.dataType ? ' | Type: ' + p.dataType : '') });
      });
    });
    state.mergedFOM.dataTypes?.basic?.forEach(d => allItems.push({ name: d.name, type: 'basic', snippet: makeSnippet(d, 'basic') }));
    state.mergedFOM.dataTypes?.simple?.forEach(d => allItems.push({ name: d.name, type: 'simple', snippet: makeSnippet(d, 'simple') }));
    state.mergedFOM.dataTypes?.array?.forEach(d => allItems.push({ name: d.name, type: 'array', snippet: makeSnippet(d, 'array') }));
    state.mergedFOM.dataTypes?.fixed?.forEach(d => {
      allItems.push({ name: d.name, type: 'fixed', snippet: makeSnippet(d, 'fixed') });
      d.fields?.forEach(f => {
        allItems.push({ name: f.name, type: 'field', parentName: d.name, parentType: 'fixed', snippet: 'Record: ' + d.name + (f.dataType ? ' | Type: ' + f.dataType : '') });
      });
    });
    state.mergedFOM.dataTypes?.enum?.forEach(d => {
      allItems.push({ name: d.name, type: 'enum', snippet: makeSnippet(d, 'enum') });
      d.values?.forEach(v => {
        allItems.push({ name: v.name, type: 'enumerator', parentName: d.name, parentType: 'enum', snippet: 'Enum: ' + d.name + (v.value !== undefined ? ' | Value: ' + v.value : '') });
      });
    });
    state.mergedFOM.dataTypes?.variant?.forEach(d => {
      allItems.push({ name: d.name, type: 'variant', snippet: makeSnippet(d, 'variant') });
      d.alternatives?.forEach(a => {
        const label = a.label || a.name || '';
        allItems.push({ name: label, type: 'alternative', parentName: d.name, parentType: 'variant', snippet: 'Variant: ' + d.name + (a.dataType ? ' | Type: ' + a.dataType : '') });
      });
    });
    state.mergedFOM.transportations?.forEach(t => allItems.push({ name: t.name, type: 'trans', snippet: makeSnippet(t, 'trans') }));
    state.mergedFOM.switches?.forEach(s => allItems.push({ name: s.name, type: 'switches', snippet: makeSnippet(s, 'switches') }));
    state.mergedFOM.tags?.forEach(t => allItems.push({ name: t.name, type: 'tags', snippet: makeSnippet(t, 'tags') }));
  }

  state.files.forEach(f => {
    f.dimensions?.forEach(d => allItems.push({ name: d.name, type: 'dims', snippet: makeSnippet(d, 'dims') }));
    f.notes?.forEach(n => {
      const nname = typeof n === 'string' ? n : n.name || '';
      allItems.push({ name: nname, type: 'notes', snippet: makeSnippet(n, 'notes') });
    });
    const ver = f.identification?.version ? ' | Version: ' + f.identification.version : '';
    allItems.push({ name: f.name, type: 'module', snippet: (f.identification?.name || '') + ver });
  });

  if (state.mergedFOM?.time) {
    allItems.push({ name: 'Time Configuration', type: 'time', snippet: '' });
  }

  if (state.appspace) {
    state.appspace.entries?.forEach(e => {
      allItems.push({ name: e.className, type: 'appspace_object', snippet: makeSnippet(e, 'appspace_object') });
      e.apps?.forEach(a => {
        const appName = typeof a === 'string' ? a : a.name || '';
        allItems.push({ name: appName, type: 'appspace_app', parentName: e.className, parentType: 'appspace_object', snippet: 'Entry: ' + e.className });
      });
    });
    state.appspace.interactions?.forEach(e => {
      allItems.push({ name: e.className, type: 'appspace_interaction', snippet: makeSnippet(e, 'appspace_interaction') });
      e.apps?.forEach(a => {
        const appName = typeof a === 'string' ? a : a.name || '';
        allItems.push({ name: appName, type: 'appspace_app', parentName: e.className, parentType: 'appspace_interaction', snippet: 'Entry: ' + e.className });
      });
    });
    state.appspace.unknown?.forEach(e => {
      allItems.push({ name: e.className, type: 'appspace_unknown', snippet: makeSnippet(e, 'appspace_unknown') });
      e.apps?.forEach(a => {
        const appName = typeof a === 'string' ? a : a.name || '';
        allItems.push({ name: appName, type: 'appspace_app', parentName: e.className, parentType: 'appspace_unknown', snippet: 'Entry: ' + e.className });
      });
    });
  }

  // Phase 1: Fuse.js fuzzy search (whole-string Levenshtein distance)
  const fuse = new Fuse(allItems, {
    keys: ['name', 'parentName'],
    threshold: 0.4,
    includeScore: true
  });

  const fuseResults = fuse.search(q).map(r => r.item);

  // Phase 2: Substring/containment matching — catches names that Fuse
  // misses due to compound/dotted paths (e.g. searching "Physical"
  // should find "HLAobjectRoot.RPRPhysical.PhysicalEntity").
  const seen = new Set(fuseResults.map(i => i.name + '|' + i.type + '|' + (i.parentName || '')));
  const substringResults = allItems.filter(i => {
    const key = i.name + '|' + i.type + '|' + (i.parentName || '');
    if (seen.has(key)) return false;
    return i.name.toLowerCase().includes(q) || (i.parentName && i.parentName.toLowerCase().includes(q));
  });

  return [...fuseResults, ...substringResults];
}

function hideSearchPanel() {
  searchStore.hideSearchPanel();
}

function showSearchPanel(results, query) {
  searchStore.showSearchPanel(results, query);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function checkForSearchMode() {
  const lastEntry = state.history[state.history.length - 1];
  if (lastEntry && lastEntry.mode === 'search') {
    const results = performSearch(lastEntry.query);
    if (results.length > 0) {
      document.getElementById('globalSearch').value = lastEntry.query;
      showSearchPanel(results, lastEntry.query);
    } else {
      state.history.pop();
      document.getElementById('backBtn').style.display = state.history.length > 0 ? 'inline-block' : 'none';
    }
  }
}
document.getElementById('globalSearch').addEventListener('input', e => {
  const query = e.target.value.trim();
  if (!query) {
    hideSearchPanel();
    return;
  }
  const results = performSearch(query);
  showSearchPanel(results, query);
});

document.getElementById('globalSearch').addEventListener('focus', () => {
  const query = document.getElementById('globalSearch').value.trim();
  if (query && !document.getElementById('searchPanel')) {
    const results = performSearch(query);
    if (results.length > 0) {
      showSearchPanel(results, query);
    }
  }
});

async function init() {
  try {
    Object.defineProperty(window, '__mergedFOM', { get: () => state.mergedFOM });
    window.__showDetail = function(name, type, isManualNav = false) { showDetail(name, type, isManualNav); };
    window.__showDataType = function(name, type) { showDataType(name, type); };
    window.__onSearchItemClick = function(item) {
      const searchInput = document.getElementById('globalSearch');
      const currentQuery = searchInput ? searchInput.value.trim() : item.query || '';
      hideSearchPanel();
      state.history.push({ mode: 'search', query: currentQuery });
      if (item.type === 'module') {
        switchToModule(item.name, true);
      } else if (item.type === 'attribute' || item.type === 'parameter' || item.type === 'enumerator' || item.type === 'field' || item.type === 'alternative') {
        showDetail(item.parentName, item.parentType, true);
      } else if (item.type === 'appspace_app') {
        showDetail(item.parentName, item.parentType, true);
      } else {
        showDetail(item.name, item.type, true);
      }
      document.getElementById('backBtn').style.display = 'inline-block';
    };
    window.__switchToModule = function(name) { const file = state.files.find(f => f.name === name); if (file) switchToModule(name, true); };
    window.__getPreferredType = getPreferredType;
    window.__detectSubspaceDimensions = detectSubspaceDimensions;
    window.__enrichAppspaceApps = enrichAppspaceApps;
    window.__findDimensionByName = findDimensionByName;
    window.__findDataTypeUsages = findDataTypeUsages;
    window.__findNoteUsages = findNoteUsages;
    window.__selectTreeItem = function(detail) {
      if (state.currentTab === 'modules') {
        const file = state.files.find(f => f.name === detail.name);
        if (file) showModuleDetails(file, true);
        return;
      }
      if (state.currentTab === 'issues') {
        if (state.selectedItem) {
          state.history.push({
            tab: state.currentTab,
            subTab: state.issuesFilter || 'all',
            selected: { ...state.selectedItem },
            detail: document.getElementById('detailHeader').style.display
          });
          document.getElementById('backBtn').style.display = 'inline-block';
        }
        showIssueDetail(detail.issueId);
        return;
      }
      const type = tabToType(state.currentTab, state.currentSubTab) || detail.type || state.currentSubTab;
      showDetail(detail.name, type, true);
    };

    // Tree filter: exposed globally for Svelte component's oninput handler
    window.__handleTreeFilter = function(rawQ) {
      const q = (rawQ || '').toLowerCase();
      if (state.currentTab === 'objects' || state.currentTab === 'interactions') {
        const classes = mergeClasses(state.files, state.currentTab === 'objects' ? 'object' : 'interaction');
        const filtered = filterClassTree(classes, q);
        const sorted = state.sortEnabled === 'asc' ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : state.sortEnabled === 'desc' ? [...filtered].sort((a, b) => b.name.localeCompare(a.name)) : filtered;
        window.__treeViewComponent?.setItems(sorted, 'tree');
      } else if (state.currentTab === 'modules') {
        const sortedFiles = state.sortEnabled === 'asc' ? [...state.files].sort((a, b) => a.name.localeCompare(b.name)) : state.sortEnabled === 'desc' ? [...state.files].sort((a, b) => b.name.localeCompare(a.name)) : state.files;
        window.__moduleListComponent?.setFiles(q ? sortedFiles.filter(f => f.name.toLowerCase().includes(q)) : sortedFiles, state.sortEnabled);
      }
    };

    updateUI();
    await loadFromStorage();
    await initRecentFiles();
  } catch(e) {
    console.error('ERROR in init():', e);
    alert('Error in init: ' + e.message);
  }
}

function filterClassTree(classes, query) {
  if (!query) return classes;
  const map = {};
  classes.forEach(c => { map[c.name] = c; });
  const matching = new Set();
  classes.forEach(c => {
    if (c.name.toLowerCase().includes(query)) {
      let current = c;
      while (current) {
        matching.add(current.name);
        current = current.parent ? map[current.parent] : null;
      }
    }
  });
  return classes.filter(c => matching.has(c.name));
}

// ============================================================================
// DATA TYPE NAVIGATION
// ============================================================================

// eslint-disable-next-line no-unused-vars
function showDataType(name, preferredType) {
  // Save current state to history BEFORE switching
  if (state.selectedItem) {
    const historyEntry = { tab: state.currentTab, subTab: state.currentSubTab, selected: { ...state.selectedItem }, detail: document.getElementById('detailHeader').style.display };
    state.history.push(historyEntry);
  }
  
  // Now load the new data type
  state.currentTab = 'datatypes'; state.currentSubTab = preferredType; state.selectedItem = { name, type: preferredType };
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const dtTab3 = document.querySelector('.tab[data-tab="datatypes"]'); if (dtTab3) dtTab3.classList.add('active');
  const dtTabs3 = document.getElementById('dataTypeTabs'); if (dtTabs3) dtTabs3.style.display = 'flex';
  document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.subtab[data-subtab="${preferredType}"]`).classList.add('active');
  saveToStorage(); updateUI();
  setTimeout(() => {
    let foundType = preferredType; let item = document.querySelector(`.tree-item[data-name="${name}"]`);
    if (!item) { const types = ['basic', 'simple', 'array', 'fixed', 'enum', 'variant']; for (const t of types) { state.currentSubTab = t; document.querySelectorAll('.subtab').forEach(st => st.classList.remove('active')); document.querySelector(`.subtab[data-subtab="${t}"]`).classList.add('active'); updateUI(); item = document.querySelector(`.tree-item[data-name="${name}"]`); if (item) { foundType = t; break; } } }
    state.currentSubTab = foundType;
    document.querySelectorAll('.subtab').forEach(st => st.classList.remove('active'));
    document.querySelector(`.subtab[data-subtab="${foundType}"]`).classList.add('active');
    
    // Highlight selected item in tree
    setTimeout(() => {
      document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('selected'));
      const item = document.querySelector(`.tree-item[data-name="${name}"]`);
      if (item) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      }
    }, 100);
    
    saveToStorage();
  }, 50);
}

// ============================================================================
// BACK BUTTON / HISTORY
// ============================================================================

function goBack() {
  if (state.history.length === 0) return;
  
  const currentTabNow = state.currentTab;
  let prev = null;
  let restoreState = { tab: null, subTab: null, selected: null };
  
  debugBack('goBack: currentTabNow=%s, history.length=%s', currentTabNow, state.history.length);
  debugBack('goBack: full history:', state.history.map(h => ({tab: h.tab, selected: h.selected?.name})));
  
  // If we're in datatypes or appspaces tab, just pop the last entry
  if (currentTabNow === 'datatypes' || currentTabNow === 'appspaces') {
    prev = state.history.pop();
    if (!prev) { document.getElementById('backBtn').style.display = 'none'; saveToStorage(); return; }
    
    if (currentTabNow === 'datatypes') {
      // Use prev.subTab for Issues tab (subtab = 'all'/'error'/'warning')
      // Use prev.selected.type for DataTypes tab (subtab = 'basic'/'simple'/etc.)
      let subTab = prev.selected?.type;
      if (prev.tab === 'issues') {
        subTab = prev.subTab || 'all';
      }
      restoreState = {
        tab: prev.tab || 'datatypes',
        subTab: subTab || 'basic',
        selected: prev.selected
      };
    } else if (currentTabNow === 'appspaces') {
      restoreState = {
        tab: prev.tab || 'appspaces',
        subTab: prev.subTab || state.appspaceSubTab,
        selected: prev.selected
      };
    }
  } else {
    // For other tabs, try to find an entry with the same tab first (for going back within same tab)
    // Otherwise find an entry with a different tab
    const validTabs = ['modules', 'objects', 'interactions', 'dims', 'trans', 'notes', 'switches', 'tags', 'time', 'datatypes', 'issues', 'appspaces'];
    let sameTabEntry = null;
    let diffTabEntry = null;
    
    debugBack('goBack: searching for sameTabEntry, currentTabNow=%s', currentTabNow);
    
    // First pass: look for same-tab entry
    for (let i = state.history.length - 1; i >= 0; i--) {
      const entry = state.history[i];
      if (entry && entry.tab && validTabs.includes(entry.tab) && entry.tab === currentTabNow) {
        sameTabEntry = entry;
        break;
      }
    }
    
    // Second pass: look for different-tab entry (only if no same-tab entry)
    if (!sameTabEntry) {
      for (let i = state.history.length - 1; i >= 0; i--) {
        const entry = state.history[i];
        if (entry && entry.tab && validTabs.includes(entry.tab) && entry.tab !== currentTabNow) {
          diffTabEntry = entry;
          break;
        }
      }
    }
    
    // Use the appropriate entry - pop it from history
    let chosenEntry = null;
    if (sameTabEntry) {
      // Remove sameTabEntry from history
      const idx = state.history.indexOf(sameTabEntry);
      state.history.splice(idx, 1);
      chosenEntry = sameTabEntry;
    } else if (diffTabEntry) {
      const idx = state.history.indexOf(diffTabEntry);
      state.history.splice(idx, 1);
      chosenEntry = diffTabEntry;
    }
    
    if (!chosenEntry) {
      document.getElementById('backBtn').style.display = 'none';
      saveToStorage(); return;
    }
    
    debugBack('goBack: chosenEntry: tab=%s, selected.name=%s, selected.type=%s', chosenEntry.tab, chosenEntry.selected?.name, chosenEntry.selected?.type);
    
    // Determine subtab
    let subTab = chosenEntry.subTab || 'basic';
    if (chosenEntry.selected?.type && ['basic','simple','array','fixed','enum','variant'].includes(chosenEntry.selected.type)) {
      subTab = chosenEntry.selected.type;
    } else if (chosenEntry.tab === 'appspaces') {
      subTab = chosenEntry.subTab || state.appspaceSubTab;
    }
    
    restoreState = {
      tab: chosenEntry.tab,
      subTab: subTab,
      selected: chosenEntry.selected
    };
  }
  
  // CRITICAL: Update state.currentTab to the restoreState tab
  state.currentTab = restoreState.tab;
  
  // Update tab UI
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${restoreState.tab}"]`)?.classList.add('active');
  
  // For datatype tab, also update the sub-tab UI
  if (restoreState.tab === 'datatypes') {
    const dtTabs4 = document.getElementById('dataTypeTabs'); if (dtTabs4) dtTabs4.style.display = 'flex';
    state.currentSubTab = restoreState.subTab;
    document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.subtab[data-subtab="${restoreState.subTab}"]`)?.classList.add('active');
  } else {
    const dtTabs4 = document.getElementById('dataTypeTabs'); if (dtTabs4) dtTabs4.style.display = 'none';
  }
  
  // For appspaces tab, update the sub-tab UI
  if (restoreState.tab === 'appspaces') {
    const appTabs4 = document.getElementById('appspaceTabs'); if (appTabs4) appTabs4.style.display = 'flex';
    state.appspaceSubTab = restoreState.subTab || 'objects';
    document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
    document.querySelector(`#appspaceTabs .subtab[data-subtab="${restoreState.subTab}"]`)?.classList.add('active');
    updateAppspaceTabCount();
  } else {
    const appTabs4 = document.getElementById('appspaceTabs'); if (appTabs4) appTabs4.style.display = 'none';
  }
  
  // For issues tab, update the sub-tab UI
  if (restoreState.tab === 'issues') {
    const isTabs4 = document.getElementById('issuesTabs'); if (isTabs4) isTabs4.style.display = 'flex';
    state.issuesFilter = ['all','error','warning'].includes(restoreState.subTab) ? restoreState.subTab : 'all';
    document.querySelectorAll('#issuesTabs .subtab').forEach(t => t.classList.remove('active'));
    document.querySelector(`#issuesTabs .subtab[data-subtab="${state.issuesFilter}"]`)?.classList.add('active');
  } else {
    const isTabs4 = document.getElementById('issuesTabs'); if (isTabs4) isTabs4.style.display = 'none';
  }
  
  debugBack('goBack: restoreState: tab=%s, subTab=%s, selected=%o', restoreState.tab, restoreState.subTab, restoreState.selected);

  if (restoreState.tab === 'appspaces') {
    const appTabs5 = document.getElementById('appspaceTabs'); if (appTabs5) appTabs5.style.display = 'flex';
    state.appspaceSubTab = restoreState.subTab || 'objects';
    document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
    document.querySelector(`#appspaceTabs .subtab[data-subtab="${state.appspaceSubTab}"]`)?.classList.add('active');
    updateAppspaceTabCount();
    state.selectedItem = restoreState.selected || null;
    renderAppspacesPanel();
    const dha = document.getElementById('detailHeader'); if (dha) dha.style.display = 'block';
    document.getElementById('detailMeta').textContent = state.appspace?.fileName || '';
    showPanel(null);
    return;
  }

  // Set the selection before rebuilding the tree (so updateUI doesn't auto-select first item)
  state.selectedItem = restoreState.selected || null;

  // Rebuild tree via bridge (handles all non-appspace tabs, skipAutoSelect=true since we restore manually)
  updateUI(true);

  // If no item was selected, keep detail hidden
  if (!restoreState.selected) {
    const dh5 = document.getElementById('detailHeader'); if (dh5) dh5.style.display = 'none';
    const ws2 = document.getElementById('welcomeScreen'); if (ws2) ws2.style.display = 'none';
    document.getElementById('backBtn').style.display = state.history.length > 0 ? 'inline-block' : 'none';
    saveToStorage();
    return;
  }

  // Scroll to selected item
  setTimeout(() => {
    window.__treeViewComponent?.scrollToItem(restoreState.selected.name);
  }, 100);
  
  // Show detail - DetailPanel will render reactively
  state.selectedItem = restoreState.selected;
  
  // For issues, show issue detail panel (not handled by DetailPanel)
  if (restoreState.selected.type === 'issue') {
    document.getElementById('backBtn').style.display = state.history.length > 0 ? 'inline-block' : 'none';
    showIssueDetail(restoreState.selected.name);
    return;
  }
  
  // Handle module rendering via showModuleDetails (still uses innerHTML)
  if (restoreState.tab === 'modules') {
    const file = state.files.find(f => f.name === restoreState.selected.name);
    if (file) {
      showModuleDetails(file, false);
    }
    document.getElementById('backBtn').style.display = state.history.length > 0 ? 'inline-block' : 'none';
    saveToStorage();
    return;
  }
  
  // Update back button visibility after popping history
  document.getElementById('backBtn').style.display = state.history.length > 0 ? 'inline-block' : 'none';
  
  saveToStorage();
}

// Issue location click delegation
document.addEventListener('click', (e) => {
  const loc = e.target.closest('.location-item');
  if (loc) {
    navigateToLocation({
      tab: loc.dataset.tab,
      subTab: loc.dataset.subtab || '',
      itemName: loc.dataset.item
    });
    return;
  }

  const issueLink = e.target.closest('.related-issue');
  if (issueLink) {
    state.history.push({
      tab: state.currentTab,
      subTab: state.currentSubTab,
      selected: state.selectedItem ? { ...state.selectedItem } : null,
      detail: 'block'
    });
    state.currentTab = 'issues';
    // Show issues subtab bar and hide DataTypes/Appspace subtab bars
    const isTabs6 = document.getElementById('issuesTabs'); if (isTabs6) isTabs6.style.display = 'flex';
    const dtTabs6 = document.getElementById('dataTypeTabs'); if (dtTabs6) dtTabs6.style.display = 'none';
    const appTabs6 = document.getElementById('appspaceTabs'); if (appTabs6) appTabs6.style.display = 'none';
    // Set subtab active state
    const validFilters = ['all', 'error', 'warning'];
    if (!state.issuesFilter || !validFilters.includes(state.issuesFilter)) {
      state.issuesFilter = 'all';
    }
    document.querySelectorAll('#issuesTabs .subtab').forEach(t => t.classList.remove('active'));
    const activeSubtab = document.querySelector(`#issuesTabs .subtab[data-subtab="${state.issuesFilter}"]`);
    if (activeSubtab) activeSubtab.classList.add('active');
    state.selectedItem = { name: issueLink.dataset.issueId, type: 'issue' };
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const issuesBtn = document.querySelector('.tab-btn[data-tab="issues"]');
    if (issuesBtn) issuesBtn.classList.add('active');
    updateUI();
    showIssueDetail(issueLink.dataset.issueId);
    document.getElementById('backBtn').style.display = state.history.length > 0 ? 'inline-block' : 'none';
  }

});

document.getElementById('backBtn').addEventListener('click', () => {
  goBack();
  checkForSearchMode();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (searchStore.searchState.visible) {
      searchStore.hideSearchPanel();
      document.getElementById('globalSearch')?.blur();
      e.preventDefault();
      return;
    }
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
    if (searchStore.searchState.visible) {
      e.preventDefault();
    }
  }
});

document.getElementById('clearBtn')?.addEventListener('click', () => {
  if (customConfig.mode === 'strict') {
    return;
  }
  if (confirm('Clear all loaded FOM files?')) {
    state.files = [];
    state.mergedFOM = null;
    state.subspaceDimensions = [];
    state.selectedItem = null;
    state.history = [];
    state.currentTab = 'modules';
    state.currentSubTab = 'basic';
    clearStorage();
    updateUI();
    state.issues = [];
    updateIssuesTabVisibility(state);
    const ws3 = document.getElementById('welcomeScreen'); if (ws3) ws3.style.display = 'flex';
    document.getElementById('globalSearch').value = '';
    hideSearchPanel();
  }
});
function updateTabScrollButtons() {
  const container = document.getElementById('tabScrollContainer');
  const leftBtn = document.getElementById('tabScrollLeft');
  const rightBtn = document.getElementById('tabScrollRight');
  if (!container || !leftBtn || !rightBtn) return;
  
  const canScrollLeft = container.scrollLeft > 0;
  const canScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth - 1;
  
  leftBtn.classList.toggle('hidden', !canScrollLeft);
  rightBtn.classList.toggle('hidden', !canScrollRight);
}

// Set up scroll listener after init
function setupTabScroll() {
  const container = document.getElementById('tabScrollContainer');
  if (container) {
    container.addEventListener('scroll', updateTabScrollButtons);
    updateTabScrollButtons();
  }
}

// ============================================================================
// APPSPACE FUNCTIONALITY
// ============================================================================

// Parse appspace file content
function parseAppspaceFile(content) {
  const lines = content.split('\n');
  const entries = [];
  
  lines.forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    // Skip CSV header line if present
    const lower = line.toLowerCase();
    if (lower.startsWith('class,') || lower.startsWith('classname,') || lower.startsWith('class|') || lower.startsWith('classname|')) {
      return;
    }
    
    let className = '';
    let apps = [];
    
    if (line.includes('|')) {
      const parts = line.split('|');
      if (parts.length === 2) {
        className = parts[0].trim();
        apps = parts[1].split(',').map(a => a.trim()).filter(a => a);
      }
    } else if (line.includes(',')) {
      const firstCommaIdx = line.indexOf(',');
      if (firstCommaIdx > 0) {
        className = line.substring(0, firstCommaIdx).trim();
        const appsStr = line.substring(firstCommaIdx + 1).trim();
        apps = appsStr.split(/[;,]/).map(a => a.trim().replace(/^["']|["']$/g, '')).filter(a => a);
      }
    }
    
    if (className && apps.length > 0) {
      entries.push({ className, apps });
    }
  });
  
  return entries;
}

// Load appspace button click handler
function setupAppspaceButtons() {
  const loadBtn = document.getElementById('loadAppspaceBtn');
  const clearBtn = document.getElementById('clearAppspaceBtn');
  const appspaceSep = document.getElementById('appspaceSeparator');
  
  if (customConfig.mode === 'strict') {
    if (loadBtn) loadBtn.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
    if (appspaceSep) appspaceSep.style.display = 'none';
    return;
  }
  
  // Set initial visibility - Load button always visible, Clear hidden until appspace loaded
  if (loadBtn) loadBtn.style.display = 'inline-block';
  if (clearBtn) clearBtn.style.display = 'none';
  
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      // Save current state in case user cancels
      const prevTab = state.currentTab;
      const prevSubTab = state.currentSubTab;
      const prevSelected = state.selectedItem;
      const prevHistory = [...state.history];
      
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.appspace,.csv,.txt';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          // User cancelled - restore previous state
          state.currentTab = prevTab;
          state.currentSubTab = prevSubTab;
          state.selectedItem = prevSelected;
          state.history = prevHistory;
          return;
        }
        
        const content = await file.text();
        const entries = parseAppspaceFile(content);
        
        // Classify entries: check object classes first, then interactions, then unknown
        const objectClasses = state.mergedFOM?.objectClasses || [];
        const interactionClasses = state.mergedFOM?.interactionClasses || [];
        
        const classified = classifyAppspaceEntries(entries, objectClasses, interactionClasses);
        
        state.appspace = {
          fileName: file.name,
          entries: classified.objects,
          interactions: classified.interactions,
          unknown: classified.unknown,
          rawContent: content
        };
        state.appspaceSubTab = 'objects';
        state.history = [];
        detectSubspaceDimensions(); enrichAppspaceApps();
        
        // Update UI
        loadBtn.textContent = 'Change Appspace';
        loadBtn.style.display = 'inline-block';
        clearBtn.style.display = 'inline-block';
        // exportSep and appspaceSep are spacers - always visible
        
        // Update tab count
        updateAppspaceTabCount();
        
        saveAppspaceToStorage();
        
        // Switch to Appspaces tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        const appspaceTab = document.querySelector('.tab[data-tab="appspaces"]');
        if (appspaceTab) appspaceTab.classList.add('active');
        state.currentTab = 'appspaces';
        state.selectedItem = null;
        
        generateAppspaceWarnings(state, makeIssue);
        updateUI();

        // Show appspace subtab bar and activate the correct subtab
        const appspaceTabs = document.getElementById('appspaceTabs');
        if (appspaceTabs) appspaceTabs.style.display = 'flex';
        document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
        const activeAppspaceSubtab = document.querySelector(`#appspaceTabs .subtab[data-subtab="${state.appspaceSubTab}"]`);
        if (activeAppspaceSubtab) activeAppspaceSubtab.classList.add('active');
        updateAppspaceTabCount();
        renderAppspacesPanel();

        const totalMatched = classified.objects.length + classified.interactions.length;
        showAppspaceSnackbar(file.name, totalMatched);
      };
      input.click();
    });
  }
   
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.appspace = null;
      state.appspaceSubTab = 'objects';
      
      // Update UI
      loadBtn.textContent = 'Load Appspace';
      loadBtn.style.display = 'inline-block';
      clearBtn.style.display = 'none';
      // exportSep and appspaceSep are spacers - always visible
      
      updateAppspaceTabCount();
      clearAppspaceFromStorage();
      generateAppspaceWarnings(state, makeIssue);
      updateUI();
    });
  }
}

// Show appspace format modal
function showAppspaceFormatModal() {
  // Remove existing modal if any
  const existing = document.getElementById('appspaceFormatModal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'appspaceFormatModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
  
  const exampleContent = `# Appspace Mapping File
# Format: ClassName|appspace1,appspace2,appspace3

HLAobjectRoot.DynamicObject|SIM_APP,LOG_APP
HLAobjectRoot.DynamicObject.Vehicle|SIM_APP
HLAobjectRoot.DynamicObject.Person|SIM_APP,LOG_APP
HLAinteractionRoot.Communication|SIM_APP,NET_APP
HLAinteractionRoot.Warfare|SIM_APP`;
  
  modal.innerHTML = `
    <div style="background:var(--bg-secondary);border-radius:var(--radius-lg);max-width:600px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:var(--card-shadow);">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--border);">
        <h2 style="margin:0;font-size:20px;color:var(--text-primary);">Appspace File Format</h2>
        <button onclick="document.getElementById('appspaceFormatModal').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text-secondary);">&times;</button>
      </div>
      <div style="padding:24px;">
        <div style="margin-bottom:16px;">
          <span style="font-size:20px;margin-right:8px;">📄</span>
          <strong style="color:var(--text-primary);">Format:</strong> <span style="color:var(--text-secondary);">Plain Text (.appspace, .csv, .txt)</span>
        </div>
        <div style="margin-bottom:16px;">
          <span style="font-size:20px;margin-right:8px;">📋</span>
          <strong style="color:var(--text-primary);">Syntax:</strong>
          <ul style="margin:8px 0 0 20px;color:var(--text-secondary);">
            <li>Each line: <code style="background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;">ClassName|appspace1,appspace2,appspace3</code></li>
            <li>Use <code style="background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;">|</code> to separate class name from appspaces</li>
            <li>Use <code style="background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;">,</code> to separate multiple appspaces</li>
            <li>Lines starting with <code style="background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;">#</code> are comments</li>
          </ul>
        </div>
        <div style="margin-bottom:16px;">
          <strong style="color:var(--text-primary);">📝 Example:</strong>
          <pre id="appspaceExample" style="background:var(--bg-tertiary);padding:16px;border-radius:var(--radius-sm);overflow-x:auto;font-family:monospace;font-size:13px;color:var(--text-primary);margin-top:8px;white-space:pre;">${exampleContent}</pre>
          <div style="display:flex;gap:12px;margin-top:12px;">
            <button onclick="copyAppspaceExample()" style="padding:8px 16px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;">📋 Copy Example</button>
            <button onclick="downloadAppspaceSample()" style="padding:8px 16px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;">⬇️ Download Sample</button>
          </div>
        </div>
        <div style="background:var(--bg-tertiary);padding:12px 16px;border-radius:var(--radius-sm);margin-top:16px;">
          <span style="font-size:16px;margin-right:8px;">ℹ️</span>
          <span style="color:var(--text-secondary);font-size:13px;">Appspace files map HLA class names to default appspaces. Appspaces are used in the creation of DDM (Data Distribution Management) regions.</span>
        </div>
      </div>
    </div>
  `;
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  document.body.appendChild(modal);
}

// Copy appspace example to clipboard
// eslint-disable-next-line no-unused-vars
async function copyAppspaceExample() {
  const example = document.getElementById('appspaceExample').textContent;
  await navigator.clipboard.writeText(example);
  showToast('✓ Example copied to clipboard!');
}

// Show toast notification
function showToast(message) {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--accent);color:white;padding:12px 24px;border-radius:var(--radius-sm);box-shadow:var(--card-shadow);z-index:10001;font-size:14px;animation:fadeInOut 3s ease-in-out;';
  
  // Add animation
  if (!document.getElementById('toastAnimation')) {
    const style = document.createElement('style');
    style.id = 'toastAnimation';
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity:0; transform:translateX(-50%) translateY(20px); }
        10% { opacity:1; transform:translateX(-50%) translateY(0); }
        90% { opacity:1; transform:translateX(-50%) translateY(0); }
        100% { opacity:0; transform:translateX(-50%) translateY(20px); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
}

// Download sample appspace file
// eslint-disable-next-line no-unused-vars
function downloadAppspaceSample() {
  const content = `# Application Space Mapping File
# Format: ClassName|app1,app2,app3

HLAobjectRoot.DynamicObject|SIM_APP,LOG_APP
HLAobjectRoot.DynamicObject.Vehicle|SIM_APP
HLAobjectRoot.DynamicObject.Person|SIM_APP,LOG_APP
HLAinteractionRoot.Communication|SIM_APP,NET_APP
HLAinteractionRoot.Warfare|SIM_APP`;
  
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample.appspace';
  a.click();
  URL.revokeObjectURL(url);
}

// Classify appspace entries: check object classes first, then interactions, then unknown
function classifyAppspaceEntries(entries, objectClasses, interactionClasses) {
  const objects = [];
  const interactions = [];
  const unknown = [];
  
  entries.forEach(entry => {
    // Check object classes first
    const objectMatch = findClassByRightSideMatch(entry.className, objectClasses);
    if (objectMatch) {
      objects.push({ ...entry, matchedClass: objectMatch.name });
      return;
    }
    
    // Check interaction classes next
    const interactionMatch = findClassByRightSideMatch(entry.className, interactionClasses);
    if (interactionMatch) {
      interactions.push({ ...entry, matchedClass: interactionMatch.name });
      return;
    }
    
    // No match found
    unknown.push({ ...entry });
  });
  
  return { objects, interactions, unknown };
}

// Update Appspaces tab count
function updateAppspaceTabCount() {
  // Sync appspace data to reactive store for LeftRail
  appspaceStore.setAppspace(state.appspace);
  
  if (!state.appspace) return;
  
  // Update subtab chip labels (FilterChips has static labels)
  const objCount = state.appspace.entries?.length || 0;
  const intCount = state.appspace.interactions?.length || 0;
  const unkCount = state.appspace.unknown?.length || 0;
  
  const objTab = document.querySelector('#appspaceTabs .subtab[data-subtab="objects"]');
  const intTab = document.querySelector('#appspaceTabs .subtab[data-subtab="interactions"]');
  const unkTab = document.querySelector('#appspaceTabs .subtab[data-subtab="unknown"]');
  
  if (objTab) objTab.textContent = `Objects (${objCount})`;
  if (intTab) intTab.textContent = `Interactions (${intCount})`;
  if (unkTab) unkTab.textContent = `Unknown (${unkCount})`;
}

// Generate warnings for FOM classes that have no appspace mapping
function generateAppspaceWarnings(state, makeIssue) {
  state.issues = state.issues.filter(i => i.category !== 'appspace');
  if (!state.appspace || !state.mergedFOM) return;
  
  const matchedObjectClasses = new Set();
  const matchedInteractionClasses = new Set();
  
  state.appspace.entries?.forEach(e => {
    if (e.matchedClass) matchedObjectClasses.add(e.matchedClass);
  });
  state.appspace.interactions?.forEach(e => {
    if (e.matchedClass) matchedInteractionClasses.add(e.matchedClass);
  });
  
  state.mergedFOM.objectClasses?.forEach(cls => {
    if (cls.name === 'HLAobjectRoot' || cls.name === 'HLAinteractionRoot') return;
    if (!matchedObjectClasses.has(cls.name)) {
      state.issues.push(makeIssue('warning', 'appspace', 'unmapped-class',
        `Object class "${cls.name}" has no appspace mapping`,
        '',
        [...(cls._sources || [])],
        [{ tab: 'objects', itemName: cls.name }]
      ));
    }
  });
  
  state.mergedFOM.interactionClasses?.forEach(cls => {
    if (cls.name === 'HLAobjectRoot' || cls.name === 'HLAinteractionRoot') return;
    if (!matchedInteractionClasses.has(cls.name)) {
      state.issues.push(makeIssue('warning', 'appspace', 'unmapped-class',
        `Interaction class "${cls.name}" has no appspace mapping`,
        '',
        [...(cls._sources || [])],
        [{ tab: 'interactions', itemName: cls.name }]
      ));
    }
  });
}

// Detect subspace dimensions: dimensions whose dataType references an enum
function detectSubspaceDimensions() {
  if (!state.mergedFOM || state.files.length === 0) {
    state.subspaceDimensions = [];
    return;
  }
  const enumTypes = state.mergedFOM.dataTypes?.enum || [];
  const enumMap = {};
  enumTypes.forEach(e => { enumMap[e.name] = e; });
  const result = [];
  const seen = new Set();
  
  state.files.forEach(f => {
    (f.dimensions || []).forEach(dim => {
      if (dim.isComplex && dim.rows) {
        dim.rows.forEach(r => {
          if (r.key.toLowerCase() === 'datatype' && enumMap[r.value]) {
            const key = `${dim.name}|${r.value}`;
            if (!seen.has(key)) {
              seen.add(key);
              result.push({
                dimensionName: dim.name,
                enumName: r.value,
                enumerators: enumMap[r.value].values || [],
              });
            }
          }
        });
      }
    });
  });
  state.subspaceDimensions = result;
}

// Enrich appspace entries with subspace dimension info
function enrichAppspaceApps() {
  if (!state.appspace || !state.subspaceDimensions || state.subspaceDimensions.length === 0) return;
  const doEnrich = (entries) => {
    entries.forEach(entry => {
      entry._subspace = [];
      entry.apps.forEach(app => {
        const appStr = typeof app === 'string' ? app : app.name || '';
        state.subspaceDimensions.forEach(sd => {
          const match = sd.enumerators.find(e => e.name === appStr);
          if (match) {
            entry._subspace.push({
              appName: appStr,
              dimensionName: sd.dimensionName,
              enumName: sd.enumName,
              enumeratorValue: match.value,
            });
          }
        });
      });
    });
  };
  doEnrich(state.appspace.entries || []);
  doEnrich(state.appspace.interactions || []);
  doEnrich(state.appspace.unknown || []);
}

// Show snackbar notification
function showAppspaceSnackbar(fileName, count) {
  const toast = document.getElementById('toast');
  toast.innerHTML = `
    <h3>Appspace Loaded</h3>
    <p>Loaded ${count} appspace association${count !== 1 ? 's' : ''} from ${fileName}</p>
  `;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.classList.remove('show', 'fade-out');
    }, 300);
  }, 4000);
}

// Save/load appspace from IndexedDB
async function saveAppspaceToStorage() {
  try {
    await storage.saveAppspace(state.appspace, state.appspaceSubTab);
  } catch (e) { console.warn('Failed to save appspace to IndexedDB:', e); }
}

async function loadAppspaceFromStorage() {
  try {
    const result = await storage.loadAppspace();
    if (result && result.data) {
      state.appspace = result.data;
      state.appspaceSubTab = result.subTab || 'objects';
      state.history = [];
      detectSubspaceDimensions(); enrichAppspaceApps();
      
      // Update UI - use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const loadBtn = document.getElementById('loadAppspaceBtn');
        const clearBtn = document.getElementById('clearAppspaceBtn');
        const exportSep = document.getElementById('exportAppspaceSeparator');
        const appspaceSep = document.getElementById('appspaceSeparator');
        if (loadBtn) {
          loadBtn.textContent = 'Change Appspace';
          loadBtn.style.display = 'inline-block';
        }
        if (clearBtn) clearBtn.style.display = 'inline-block';
        if (exportSep) exportSep.style.display = 'block';
        if (appspaceSep) appspaceSep.style.display = 'block';
        
        updateAppspaceTabCount();
      }, 0);
    }
  } catch (e) { console.warn('Failed to load appspace from IndexedDB:', e); }
}

async function clearAppspaceFromStorage() {
  try {
    await storage.clearAppspace();
    state.history = [];
  } catch (e) { console.warn('Failed to clear appspace from IndexedDB:', e); }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

try {
  console.log('About to call init()...');
  init();
  setupTabScroll();
} catch(e) {
  console.error('ERROR in init/setupTabScroll:', e);
  alert('Error in init: ' + e.message);
}

// Ensure DOM is ready before setting up appspace buttons
function doSetup() {
  setupAppspaceButtons();
  loadAppspaceFromStorage();
}

try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doSetup);
  } else {
    doSetup();
  }
} catch(e) {
  console.error('ERROR during setup:', e);
  alert('Error: ' + e.message);
}

// ============================================================================
// THEME SELECT
// ============================================================================

window.applyTheme = applyTheme;
window.showAppspaceFormatModal = showAppspaceFormatModal;

function initTheme() {
  const savedTheme = localStorage.getItem('fomViewerTheme') || 'system';
  applyTheme(savedTheme);
  const sel = document.getElementById('overflowThemeSelect');
  if (sel) sel.value = savedTheme;
}

function applyTheme(theme) {
  let resolved;
  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    resolved = theme;
  }
  document.documentElement.setAttribute('data-theme', resolved);
  localStorage.setItem('fomViewerTheme', theme);
}

// Listen for system preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const savedTheme = localStorage.getItem('fomViewerTheme') || 'system';
  if (savedTheme === 'system') applyTheme('system');
});

// About button handler
document.getElementById('aboutBtn')?.addEventListener('click', () => {
  const metaVersion = document.querySelector('meta[name="version"]')?.content;
  const version = (metaVersion && metaVersion !== '__VERSION__') ? metaVersion : '-1.-1.-1';
  const toast = document.getElementById('toast');
  toast.innerHTML = `
    <h3>About ${customConfig.title || 'FOM Viewer'}</h3>
    <p>Single-page HTML viewer for IEEE 1516 FOM files. Load multiple FOM, MIM, and FED files to explore HLA data models.</p>
    <div class="version">Version ${version} | <a href="https://github.com/dalemarchand/fom-viewer" target="_blank" style="color:var(--accent)">GitHub</a></div>
  `;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.classList.remove('show', 'fade-out');
    }, 300);
  }, 4000);
});

// Appspace info button handler (overflow menu)
document.getElementById('appspaceInfoItem')?.addEventListener('click', showAppspaceFormatModal);

initTheme();

// ============================================================================
// TEST HARNESS — expose module-scoped state/functions for Puppeteer evaluate()
// ============================================================================

window.state = state;
window.showDetail = showDetail;
window.validate = () => validate(state, makeIssue);
window._detectCircularDependencies = () => detectCircularDependencies(state, makeIssue);
window.removeFile = removeFile;
window.clearStorage = clearStorage;
window.updateUI = updateUI;
window.showDataType = showDataType;
window.goBack = goBack;
const showIssueDetail = (issueId) => {
  const issue = state.issues.find(i => i.id === issueId);
  if (!issue) return;
  state.selectedItem = { name: issue.id, type: 'issue', message: issue.message, severity: issue.severity, location: issue.location, detail: issue.detail, sources: issue.sources, locations: issue.locations, category: issue.category, issueType: issue.type };
  saveToStorage();
};
window.showIssueDetail = showIssueDetail;
window.updateSortButton = updateSortButton;
window.updateTabCounts = updateTabCounts;
window.updateIssuesTabVisibility = updateIssuesTabVisibility;
window.updateAppspaceTabCount = updateAppspaceTabCount;
window.navigateToLocation = navigateToLocation;
window.saveToStorage = saveToStorage;
window.loadFromStorage = loadFromStorage;
window.saveAppspaceToStorage = saveAppspaceToStorage;
window.loadAppspaceFromStorage = loadAppspaceFromStorage;
window.clearAppspaceFromStorage = clearAppspaceFromStorage;
window.makeIssue = makeIssue;
window.generateAppspaceWarnings = generateAppspaceWarnings;
window.parseAppspaceFile = parseAppspaceFile;
window.classifyAppspaceEntries = classifyAppspaceEntries;
window.showAppspaceSnackbar = showAppspaceSnackbar;
window.doSetup = doSetup;
window.initTheme = initTheme;

window.loadFiles = loadFiles;
window.renderAppspacesPanel = renderAppspacesPanel;
window.mergeClasses = mergeClasses;

window.hashCode = hashCode;
window.customConfig = customConfig;

document.getElementById('restoreBundleBtn')?.addEventListener('click', async () => {
  if (confirm(`Are you sure you want to restore the pre-loaded bundle of "${customConfig.title || 'FOM Viewer'}"? This will reset your current workspace.`)) {
    try {
      await storage.clearAll();
      if (customConfig.preloadedFiles && customConfig.preloadedFiles.length > 0) {
        await storage.saveFiles(customConfig.preloadedFiles);
      }
      if (customConfig.preloadedAppspace) {
        await storage.saveAppspace(
          {
            fileName: customConfig.preloadedAppspace.fileName,
            rawContent: customConfig.preloadedAppspace.content
          },
          'objects'
        );
      }
      await storage.saveBundleId(customConfig.bundleId);
      await storage.saveUiState({
        currentTab: 'overview',
        currentSubTab: 'basic',
        selectedItem: null,
        sortEnabled: 'asc',
        issuesFilter: 'all'
      });
      window.location.reload();
    } catch (e) {
      alert("Failed to restore bundle: " + e.message);
    }
  }
});

window.showModuleDetails = showModuleDetails;
window.updateUI = updateUI;
window.renderModuleBody = renderModuleBody;

// ============================================================================
// END OF FILE
// ============================================================================

