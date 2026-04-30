// ============================================================================
// CONSTANTS & STATE
// ============================================================================

const DEBUG_BACK_BUTTON = false;

const STORAGE_KEY = 'fomViewerFiles';
const DB_NAME = 'FOMViewerDB';
const DB_VERSION = 1;
const STORE_NAME = 'fomFiles';

const state = {
  files: [],
  mergedFOM: null,
  currentTab: 'modules',
  currentSubTab: 'basic',
  selectedItem: null,
  sortEnabled: 'asc', // 'asc', 'desc', or false (off)
  conflicts: [],
  errors: [],
  history: [],
  // Appspace state
  // Structure: { fileName, entries: [{ className, apps: [] }], interactions: [{ className, apps: [], matchedClass }], unknown: [{ className, apps: [] }]
  appspace: null, // { fileName, entries, interactions, unknown }
  appspaceSubTab: 'objects', // 'objects', 'interactions', or 'unknown'
  uiState: {
    currentTab: 'modules',
    currentSubTab: 'basic',
    selectedItem: null,
    sortEnabled: 'asc'
  }
};

let db = null;

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

function debugBack(msg, ...args) {
  if (DEBUG_BACK_BUTTON) console.log('[BACK]', msg, ...args);
}

// ============================================================================
// DATABASE (IndexedDB for file caching)
// ============================================================================

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
  });
}

// ============================================================================
// STORAGE (IndexedDB persistence)
// ============================================================================

async function saveToStorage() {
  const fileData = state.files.map(f => ({ name: f.name, xml: f.xml }));
  const uiState = { currentTab: state.currentTab, currentSubTab: state.currentSubTab, selectedItem: state.selectedItem, sortEnabled: state.sortEnabled };
  try {
    if (!db) await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    for (const file of fileData) { store.add(file); }
    store.put({ name: '__uiState__', uiState: uiState });
    // Save appspace state
    if (state.appspace) {
      store.put({ name: '__appspace__', data: state.appspace, subTab: state.appspaceSubTab });
    }
  } catch (e) { console.warn('Failed to save to IndexedDB:', e); }
}

async function clearStorage() {
  try {
    if (!db) await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
  } catch (e) { console.warn('Failed to clear IndexedDB:', e); }
}

// ============================================================================
// FILE LOADING & PARSING
// ============================================================================

async function loadFromStorage() {
  try {
    if (!db) await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const uiStateRequest = store.get('__uiState__');
    const uiState = await new Promise((resolve) => { uiStateRequest.onsuccess = () => resolve(uiStateRequest.result?.uiState); uiStateRequest.onerror = () => resolve(null); });
    if (uiState) {
      state.currentTab = uiState.currentTab || 'modules';
      state.currentSubTab = uiState.currentSubTab || 'basic';
      state.selectedItem = uiState.selectedItem || null;
      state.sortEnabled = uiState.sortEnabled !== undefined ? uiState.sortEnabled : 'asc';
      updateSortButton();
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelector(`.tab[data-tab="${state.currentTab}"]`).classList.add('active');
      const dtTabs = document.getElementById('dataTypeTabs');
      dtTabs.style.display = state.currentTab === 'datatypes' ? 'flex' : 'none';
      const appspaceTabs = document.getElementById('appspaceTabs');
      appspaceTabs.style.display = state.currentTab === 'appspaces' ? 'flex' : 'none';
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
    }
    // Load appspace data
    const appspaceRequest = store.get('__appspace__');
    const appspaceData = await new Promise((resolve) => { appspaceRequest.onsuccess = () => resolve(appspaceRequest.result); appspaceRequest.onerror = () => resolve(null); });
    if (appspaceData && appspaceData.data) {
      state.appspace = appspaceData.data;
      state.appspaceSubTab = appspaceData.subTab || 'objects';
      // No longer using hideUnmatched - entries are classified as objects/interactions/unknown
      // Update UI
      const loadBtn = document.getElementById('loadAppspaceBtn');
      const clearBtn = document.getElementById('clearAppspaceBtn');
      const separator = document.getElementById('appspaceSeparator');
      if (loadBtn) { loadBtn.textContent = 'Change Appspace'; loadBtn.style.display = 'inline-block'; }
      if (clearBtn) clearBtn.style.display = 'inline-block';
      if (separator) separator.style.display = 'block';
      const appspaceTab = document.querySelector('.tab[data-tab="appspaces"]');
      if (appspaceTab) appspaceTab.style.display = 'block';
      updateAppspaceTabCount();
    }
    const fileRequest = store.getAll();
    const allData = await new Promise((resolve) => { fileRequest.onsuccess = () => resolve(fileRequest.result); fileRequest.onerror = () => resolve([]); });
    const fileData = allData.filter(f => f.name !== '__uiState__' && f.name !== '__appspace__');
    if (Array.isArray(fileData) && fileData.length > 0) {
      fileData.forEach(f => {
        try { const parser = new FOMParser(f.xml); const fom = parser.parse(); state.files.push(fom); }
        catch (e) { console.error('Failed to parse stored file', f.name, e); }
      });
      if (state.files.length > 0) {
        const sorted = topologicalSort(state.files);
        state.mergedFOM = { objectClasses: mergeClasses(sorted, 'object'), interactionClasses: mergeClasses(sorted, 'interaction'), dataTypes: mergeDataTypes(sorted), transportations: mergeTransportations(sorted), switches: mergeSwitches(sorted), tags: mergeTags(sorted), time: mergeTime(sorted) };
        updateUI();
        if (state.selectedItem) {
          const escapeCss = (s) => s.replace(/"/g, '\\"').replace(/\n/g, '\\n');
          setTimeout(() => {
            const item = document.querySelector(`.tree-item[data-name="${escapeCss(state.selectedItem.name)}"]`);
            if (item) { item.classList.add('selected'); }
            if (state.currentTab === 'modules') {
              const file = state.files.find(f => f.name === state.selectedItem.name);
              if (file) showModuleDetails(file, false);
            } else {
              showDetail(state.selectedItem.name, state.selectedItem.type);
            }
          }, 50);
        } else {
          setTimeout(() => {
            const firstItem = document.querySelector('.tree-item');
            if (firstItem) {
              firstItem.classList.add('selected');
              const name = firstItem.dataset.name;
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

  // Build full hierarchical name by walking up the DOM tree
  buildFullName(el, validTagNames) {
    if (!el) return '';
    const name = el.querySelector('name')?.textContent || '';
    if (!name) return '';
    // HLAobjectRoot and HLAinteractionRoot are roots - don't prepend anything
    if (name === 'HLAobjectRoot' || name === 'HLAinteractionRoot') return name;
    const parentEl = el.parentElement;
    if (parentEl && validTagNames.includes(parentEl.tagName)) {
      const parentFullName = this.buildFullName(parentEl, validTagNames);
      return parentFullName + '.' + name;
    }
    return name;
  }

  parse() {
    const doc = this.parser.parseFromString(this.xml, 'text/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) throw new Error('XML parse error: ' + parseError.textContent);
    const modelIdent = doc.querySelector('modelIdentification');
    const name = modelIdent?.querySelector('name')?.textContent || 'Unknown';
    const version = modelIdent?.querySelector('version')?.textContent || '1.0';
    const dependencies = this.parseDependencies(modelIdent);
    const objectClasses = this.parseObjectClasses(doc);
    const interactionClasses = this.parseInteractionClasses(doc);
    const dataTypes = this.parseDataTypes(doc);
    const modelIdentification = this.parseModelIdentificationFull(modelIdent);
    const dimResult = this.parseDimensions(doc);
    const transResult = this.parseTransportations(doc);
    const notes = this.parseNotes(doc);
    const switches = this.parseSwitches(doc);
    const tags = this.parseTags(doc);
    const time = this.parseTime(doc);
    return { name, version, dependencies, objectClasses, interactionClasses, dataTypes, modelIdentification, dimensions: dimResult.result, transportations: transResult.result, transportWarnings: transResult.warnings, notes, switches, tags, time, xml: this.xml };
  }
  parseModelIdentificationFull(modelIdent) {
    if (!modelIdent || typeof modelIdent === 'string' || !modelIdent.children) return [];
    const result = [];
    const seen = {};
    
    const children = Array.from(modelIdent.children).filter(c => c.nodeType === 1);
    for (const child of children) {
      const tag = child.tagName ? child.tagName.split('}').pop() : (child.tag || '').split('}').pop();
      if (!tag || seen[tag]) continue;
      
      const elems = modelIdent.querySelectorAll(tag);
      if (elems.length === 1) {
        const text = child.textContent?.trim();
        if (!text) continue;
        if (child.children && child.children.length > 0) {
          const subRows = [];
          const subChildren = Array.from(child.children).filter(c => c.nodeType === 1);
          for (const sub of subChildren) {
            const subTag = sub.tagName ? sub.tagName.split('}').pop() : (sub.tag || '').split('}').pop();
            const subText = sub.textContent?.trim();
            if (subText) subRows.push({ key: subTag, value: subText });
          }
          if (subRows.length > 0) result.push({ key: tag, value: '', isSubTable: true, rows: subRows });
        } else {
          result.push({ key: tag, value: text });
        }
      } else {
        const uniqueValues = new Set();
        elems.forEach(e => { const t = e.textContent?.trim(); if (t) uniqueValues.add(t); });
        const values = Array.from(uniqueValues);
        if (values.length > 0) {
          result.push({ key: tag, value: '', isList: true, values: values });
        }
      }
      seen[tag] = true;
    }
    return result;
  }
  parseListElements(doc, selector) {
    const els = doc.querySelectorAll(selector);
    return Array.from(els).map(el => el.textContent?.trim()).filter(t => t);
  }
  parseDimensions(doc) {
    const result = [];
    const warnings = [];
    const root = doc.documentElement;
    if (!root) return { result, warnings };
    for (let i = 0; i < root.children.length; i++) {
      const el = root.children[i];
      if (el.tagName && el.tagName.includes('dimensions')) {
        const seen = {};
        for (let j = 0; j < el.children.length; j++) {
          const dim = el.children[j];
          if (dim.tagName && dim.tagName.includes('dimension')) {
            const nameEl = dim.querySelector('name');
            const name = nameEl ? nameEl.textContent?.trim() : dim.textContent?.trim() || '';
            if (name && !seen[name]) {
              seen[name] = true;
              const childEls = Array.from(dim.children).filter(c => c.nodeType === 1);
              if (childEls.length > 0) {
                const rows = [];
                childEls.forEach(child => {
                  const tag = child.tagName ? child.tagName.split('}').pop() : null;
                  const text = child.textContent?.trim();
                  if (tag && text && tag !== 'name') rows.push({ key: tag, value: text });
                });
                result.push({ name, isComplex: true, rows });
              } else {
                result.push({ name, isComplex: false });
              }
            }
          }
        }
        break;
      }
    }
    const merged = [];
    const dimSeen = {};
    for (const d of result) {
      if (!dimSeen[d.name]) {
        dimSeen[d.name] = d;
        merged.push(d);
      } else {
        const existing = dimSeen[d.name];
        if (d.isComplex && d.rows && d.rows.length > 0) {
          if (!existing.rows) existing.rows = [];
          d.rows.forEach(r => {
            if (!existing.rows.some(er => er.key === r.key && er.value === r.value)) {
              existing.rows.push(r);
            }
          });
        }
      }
    }
    return { result: merged, warnings };
  }
  parseNotes(doc) {
    const result = [];
    const root = doc.documentElement;
    if (!root) return result;
    for (let i = 0; i < root.children.length; i++) {
      const el = root.children[i];
      if (el.tagName && el.tagName.includes('notes')) {
        for (let j = 0; j < el.children.length; j++) {
          const note = el.children[j];
          if (note.tagName && note.tagName.includes('note')) {
            const label = note.querySelector('label')?.textContent?.trim() || '';
            const semantics = note.querySelector('semantics')?.textContent?.trim() || '';
            const rows = [];
            const childEls = Array.from(note.children).filter(c => c.nodeType === 1);
            childEls.forEach(child => {
              const tag = child.tagName ? child.tagName.split('}').pop() : null;
              const text = child.textContent?.trim();
              if (tag && text && tag !== 'label' && tag !== 'semantics') rows.push({ key: tag, value: text });
            });
            result.push({ name: label, semantics: semantics, rows: rows });
          }
        }
        break;
      }
    }
    return result;
  }
  parseTransportations(doc) {
    const result = [];
    const warnings = [];
    const root = doc.documentElement;
    if (!root) return { result, warnings };
    for (let i = 0; i < root.children.length; i++) {
      const el = root.children[i];
      if (el.tagName && el.tagName.includes('transportations')) {
        for (let j = 0; j < el.children.length; j++) {
          const trans = el.children[j];
          if (trans.tagName && trans.tagName.includes('transportation')) {
            const nameEl = trans.querySelector('name');
            const name = nameEl ? nameEl.textContent?.trim() : trans.textContent?.trim() || '';
            const reliable = trans.querySelector('reliable')?.textContent?.trim() || '';
            const semanticsEl = trans.querySelector('semantics');
            const semantics = semanticsEl ? semanticsEl.textContent?.trim() : '';
            const rows = [];
            const childEls = Array.from(trans.children).filter(c => c.nodeType === 1);
            childEls.forEach(child => {
              const tag = child.tagName ? child.tagName.split('}').pop() : null;
              const text = child.textContent?.trim();
              if (tag && text && tag !== 'name' && tag !== 'reliable' && tag !== 'semantics') rows.push({ key: tag, value: text });
            });
            if (name) result.push({ name, reliable, semantics, rows: rows.length > 0 ? rows : null });
          }
        }
        break;
      }
    }
    const merged = [];
    const seen = {};
    for (const t of result) {
      if (!seen[t.name]) {
        seen[t.name] = t;
        merged.push(t);
      } else {
        const existing = seen[t.name];
        if (existing.reliable !== t.reliable) {
          warnings.push(`Transportation "${t.name}" has conflicting reliable values: "${existing.reliable}" vs "${t.reliable}"`);
        }
        if (existing.semantics !== t.semantics) {
          warnings.push(`Transportation "${t.name}" has conflicting semantics: "${existing.semantics}" vs "${t.semantics}"`);
        }
        if (t.rows && t.rows.length > 0) {
          if (!existing.rows) existing.rows = [];
          t.rows.forEach(r => {
            if (!existing.rows.some(er => er.key === r.key && er.value === r.value)) {
              existing.rows.push(r);
            }
          });
        }
      }
    }
    return { result: merged, warnings };
  }
  parseSwitches(doc) {
    const result = [];
    const root = doc.documentElement;
    if (!root) return result;
    for (let i = 0; i < root.children.length; i++) {
      const el = root.children[i];
      if (el.tagName && el.tagName.includes('switches')) {
        for (let j = 0; j < el.children.length; j++) {
          const sw = el.children[j];
          if (sw.tagName && sw.nodeType === 1) {
            const name = sw.tagName.split('}').pop() || sw.tagName;
            const isEnabled = sw.getAttribute('isEnabled');
            const value = sw.getAttribute('resignAction') || isEnabled || '';
            const semantics = sw.querySelector('semantics')?.textContent?.trim() || '';
            if (name) result.push({ name, value, semantics });
          }
        }
        break;
      }
    }
    return result;
  }
  parseTags(doc) {
    const result = [];
    const root = doc.documentElement;
    if (!root) return result;
    for (let i = 0; i < root.children.length; i++) {
      const el = root.children[i];
      if (el.tagName && el.tagName.includes('tags')) {
        for (let j = 0; j < el.children.length; j++) {
          const tag = el.children[j];
          if (tag.tagName && tag.nodeType === 1) {
            const name = tag.tagName.split('}').pop() || tag.tagName;
            const dataType = tag.querySelector('dataType')?.textContent?.trim() || '';
            const semantics = tag.querySelector('semantics')?.textContent?.trim() || '';
            if (name) result.push({ name, dataType, semantics });
          }
        }
        break;
      }
    }
    return result;
  }
  parseTime(doc) {
    const result = {};
    const root = doc.documentElement;
    if (!root) return result;
    for (let i = 0; i < root.children.length; i++) {
      const el = root.children[i];
      if (el.tagName && el.tagName.includes('time')) {
        const timeStamp = el.querySelector('timeStamp');
        if (timeStamp) {
          result.timeStamp = {
            dataType: timeStamp.querySelector('dataType')?.textContent?.trim() || '',
            semantics: timeStamp.querySelector('semantics')?.textContent?.trim() || ''
          };
        }
        const lookahead = el.querySelector('lookahead');
        if (lookahead) {
          result.lookahead = {
            dataType: lookahead.querySelector('dataType')?.textContent?.trim() || '',
            semantics: lookahead.querySelector('semantics')?.textContent?.trim() || ''
          };
        }
        break;
      }
    }
    return result;
  }
  getSource(doc) {
    return doc.querySelector('modelIdentification > name')?.textContent || '';
  }
  parseDependencies(modelIdent) {
    const refs = modelIdent?.querySelectorAll('reference') || [];
    const deps = [];
    refs.forEach(ref => {
      const type = ref.querySelector('type')?.textContent;
      if (type === 'Dependency') {
        const name = ref.querySelector('identification')?.textContent || ref.querySelector('name')?.textContent;
        if (name) deps.push(name);
      }
    });
    return deps;
  }

  parseObjectClasses(doc) {
    const classes = [];
    const elements = doc.querySelectorAll('objectClass, objectClassRTI');
    elements.forEach(el => {
      const name = el.querySelector('name')?.textContent || '';
      if (!name) return;
      // Build full hierarchical name by walking up the DOM
      const fullName = this.buildFullName(el, ['objectClass', 'objectClassRTI']);
      const parentEl = el.parentElement;
      const fullParentName = (parentEl && (parentEl.tagName === 'objectClass' || parentEl.tagName === 'objectClassRTI')) ? this.buildFullName(parentEl, ['objectClass', 'objectClassRTI']) : '';
      const sharing = el.querySelector('sharing')?.textContent || '';
      const semantics = el.querySelector('semantics')?.textContent || '';
      const classNotes = el.getAttribute('notes') || '';
      const attributes = [];
      // Only get direct child attributes, not nested ones
      const childNodes = el.childNodes;
      childNodes.forEach(node => {
        if (node.nodeName === 'attribute' || node.nodeName === 'attributeRTI') {
          const attrName = node.querySelector('name')?.textContent || '';
          const attrSharing = node.querySelector('sharing')?.textContent || '';
          const attrSemantics = node.querySelector('semantics')?.textContent || '';
          const attrNotes = node.getAttribute('notes') || '';
          const dt = node.querySelector('dataType')?.textContent || '';
          const updateType = node.querySelector('updateType')?.textContent || '';
          const updateCondition = node.querySelector('updateCondition')?.textContent || '';
          const ownership = node.querySelector('ownership')?.textContent || '';
          const transportation = node.querySelector('transportation')?.textContent || '';
          const order = node.querySelector('order')?.textContent || '';
          if (attrName) attributes.push({ name: attrName, sharing: attrSharing, semantics: attrSemantics, notes: attrNotes, dataType: dt, updateType, updateCondition, ownership, transportation, order });
        }
      });
      classes.push({ name: fullName, sharing, semantics, notes: classNotes, attributes, parent: fullParentName, _source: this.getSource(doc) });
    });
    return classes;
  }

  parseInteractionClasses(doc) {
    const classes = [];
    const elements = doc.querySelectorAll('interactionClass, interactionClassRTI');
    elements.forEach(el => {
      const name = el.querySelector('name')?.textContent || '';
      if (!name) return;
      // Build full hierarchical name by walking up the DOM
      const fullName = this.buildFullName(el, ['interactionClass', 'interactionClassRTI']);
      const parentEl = el.parentElement;
      const fullParentName = (parentEl && (parentEl.tagName === 'interactionClass' || parentEl.tagName === 'interactionClassRTI')) ? this.buildFullName(parentEl, ['interactionClass', 'interactionClassRTI']) : '';
      const sharing = el.querySelector('sharing')?.textContent || '';
      const semantics = el.querySelector('semantics')?.textContent || '';
      const classNotes = el.getAttribute('notes') || '';
      const dimensionEls = el.querySelectorAll('dimensions > dimension');
      const dimensions = Array.from(dimensionEls).map(d => d.textContent).filter(d => d);
      const transportation = el.querySelector('transportation')?.textContent || '';
      const order = el.querySelector('order')?.textContent || '';
      const parameters = [];
      // Only get direct child parameters, not nested ones
      const childNodes = el.childNodes;
      childNodes.forEach(node => {
        if (node.nodeName === 'parameter' || node.nodeName === 'parameterRTI') {
          const paramName = node.querySelector('name')?.textContent || '';
          const paramSharing = node.querySelector('sharing')?.textContent || '';
          const paramSemantics = node.querySelector('semantics')?.textContent || '';
          const paramNotes = node.getAttribute('notes') || '';
          const dt = node.querySelector('dataType')?.textContent || '';
          const order = node.querySelector('order')?.textContent || '';
          if (paramName) parameters.push({ name: paramName, sharing: paramSharing, semantics: paramSemantics, notes: paramNotes, dataType: dt, order });
        }
      });
      classes.push({ name: fullName, sharing, semantics, notes: classNotes, dimensions, transportation, order, parameters, parent: fullParentName, _source: this.getSource(doc) });
    });
    return classes;
  }
  parseDataTypes(doc) {
    const basic = [];
    const basicEls = doc.querySelectorAll('basicData');
    basicEls.forEach(el => {
      const name = el.querySelector('name')?.textContent || '';
      const size = el.querySelector('size')?.textContent || '';
      const encoding = el.querySelector('encoding')?.textContent || '';
      const endian = el.querySelector('endian')?.textContent || '';
      const interpretation = el.querySelector('interpretation')?.textContent || '';
      const semantics = el.querySelector('semantics')?.textContent || '';
      if (name) basic.push({ name, size, encoding, endian, interpretation, semantics, _source: this.getSource(doc) });
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
      if (name) simple.push({ name, representation, units, resolution, accuracy, semantics, notes: simpleNotes, _source: this.getSource(doc) });
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
      if (name) array.push({ name, dataType, cardinality, encoding, semantics, notes: arrayNotes, _source: this.getSource(doc) });
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
      fixed.push({ name, encoding, semantics, notes: fixedNotes, fields, _source: this.getSource(doc) });
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
      enumTypes.push({ name, representation, semantics, notes: enumNotes, values, _source: this.getSource(doc) });
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
        const altEnumerator = alt.querySelector('enumerator')?.textContent || '';
        const altDt = alt.querySelector('dataType')?.textContent || '';
        const altSemantics = alt.querySelector('semantics')?.textContent || '';
        const altNotes = alt.getAttribute('notes') || '';
        if (altLabel) alternatives.push({ label: altLabel, enumerator: altEnumerator, dataType: altDt, semantics: altSemantics, notes: altNotes });
      });
      variant.push({ name, discriminant, dataType, encoding, semantics, notes: variantNotes, alternatives, _source: this.getSource(doc) });
    });
    return { basic, simple, array, fixed, enum: enumTypes, variant };
  }
}

// ============================================================================
// FOM MERGING & ANALYSIS
// ============================================================================

function topologicalSort(files) {
  const graph = {};
  const inDegree = {};
  files.forEach(f => { graph[f.name] = []; inDegree[f.name] = 0; });
  files.forEach(f => { f.dependencies.forEach(dep => { if (graph[dep] !== undefined) { graph[dep].push(f.name); inDegree[f.name]++; } }); });
  const queue = files.filter(f => inDegree[f.name] === 0).map(f => f.name);
  const result = [];
  while (queue.length > 0) {
    const current = queue.shift();
    const file = files.find(f => f.name === current);
    if (file) result.push(file);
    graph[current].forEach(neighbor => { inDegree[neighbor]--; if (inDegree[neighbor] === 0) queue.push(neighbor); });
  }
  return result;
}

function mergeClasses(files, type) {
  const map = {};
  files.forEach(file => {
    const classes = type === 'object' ? file.objectClasses : file.interactionClasses;
    classes.forEach(c => {
      if (!map[c.name]) { map[c.name] = { ...c, _sources: [file.name] }; }
      else { 
        map[c.name]._sources.push(file.name); 
        // Merge unique attributes from all sources
        if (c.attributes) {
          const existingAttrs = map[c.name].attributes || [];
          const existingNames = new Set(existingAttrs.map(a => a.name));
          c.attributes.forEach(attr => {
            if (!existingNames.has(attr.name)) {
              existingAttrs.push(attr);
              existingNames.add(attr.name);
            }
          });
          map[c.name].attributes = existingAttrs;
        }
        // Merge unique parameters
        if (c.parameters) {
          const existingParams = map[c.name].parameters || [];
          const existingNames = new Set(existingParams.map(p => p.name));
          c.parameters.forEach(param => {
            if (!existingNames.has(param.name)) {
              existingParams.push(param);
              existingNames.add(param.name);
            }
          });
          map[c.name].parameters = existingParams;
        }
      }
    });
  });
  return Object.values(map);
}

function mergeTransportations(files) {
  const map = {};
  const warnings = [];
  files.forEach(f => {
    const transList = f.transportations || [];
    transList.forEach(t => {
      if (!map[t.name]) {
        map[t.name] = { ...t, _sources: [f.name] };
      } else {
        map[t.name]._sources.push(f.name);
        if (map[t.name].reliable !== t.reliable && t.reliable) {
          warnings.push(`Transportation "${t.name}" has conflicting reliable values`);
        }
        if (!map[t.name].semantics && t.semantics) {
          map[t.name].semantics = t.semantics;
        } else if (map[t.name].semantics !== t.semantics && t.semantics) {
          warnings.push(`Transportation "${t.name}" has conflicting semantics`);
        }
        if (t.rows && t.rows.length > 0) {
          if (!map[t.name].rows) map[t.name].rows = [];
          t.rows.forEach(r => {
            if (!map[t.name].rows.some(er => er.key === r.key && er.value === r.value)) {
              map[t.name].rows.push(r);
            }
          });
        }
      }
    });
  });
  return Object.values(map);
}

function mergeDataTypes(files) {
  const result = { basic: [], simple: [], array: [], fixed: [], enum: [], variant: [] };
  const typeMap = { basic: 'basic', simple: 'simple', array: 'array', fixed: 'fixed', enum: 'enum', variant: 'variant' };
  Object.keys(typeMap).forEach(type => {
    const map = {};
    const addToMap = (items) => {
      items.forEach(item => {
        if (!map[item.name]) { map[item.name] = { ...item, _sources: [item._source] }; }
        else { map[item.name]._sources.push(item._source); if (type === 'fixed' || type === 'enum' || type === 'variant') map[item.name][type === 'enum' ? 'values' : type === 'variant' ? 'alternatives' : 'fields'] = mergeArrayProperty(map[item.name], item, type); }
      });
    };
    files.forEach(f => addToMap(f.dataTypes[typeMap[type]] || []));
    const values = Object.values(map);
    if (type === 'enum' || type === 'variant') { state.conflicts = state.conflicts.filter(c => c.type !== type); checkConflicts(values, type); }
    result[type] = values;
  });
  return result;
}

function mergeArrayProperty(existing, incoming, type) {
  const propName = type === 'fixed' ? 'fields' : type === 'enum' ? 'values' : 'alternatives';
  const existingArr = existing[propName] || [];
  const incomingArr = incoming[propName] || [];
  return [...existingArr, ...incomingArr];
}

function checkConflicts(items, type) {
  items.forEach(item => {
    if (item._sources && item._sources.length > 1) {
      if (type === 'enum') {
        const values = item.values || [];
        const valueMap = {};
        values.forEach(v => {
          if (!valueMap[v.value]) valueMap[v.value] = [];
          valueMap[v.value].push(v.name);
        });
        let hasConflict = false;
        Object.keys(valueMap).forEach(val => {
          const names = valueMap[val];
          if (names.length > 1) {
            const uniqueNames = [...new Set(names)];
            if (uniqueNames.length > 1) hasConflict = true;
          }
        });
        if (hasConflict) {
          state.conflicts.push({ name: item.name, type, sources: item._sources, reason: 'Enumerators with same value have different names' });
        }
      } else if (type === 'variant') {
        const hasConflict = item._sources.some(source1 => {
          const alt1 = getSourceVariantAlternatives(item, source1);
          return item._sources.some(source2 => {
            if (source1 === source2) return false;
            const alt2 = getSourceVariantAlternatives(item, source2);
            return !areVariantAlternativesEqual(alt1, alt2);
          });
        });
        if (hasConflict) {
          state.conflicts.push({ name: item.name, type, sources: item._sources, reason: 'Alternatives differ across modules' });
        }
      }
    }
  });
}

function getSourceEnumValues(item, source) {
  if (!item._sourceValues) {
    item._sourceValues = {};
    item._sources.forEach(s => {
      const sourceFile = state.files.find(f => name === s);
    });
  }
  const file = state.files.find(f => f.name === source);
  if (!file) return item.values || [];
  const enumType = file.dataTypes.enum?.find(e => e.name === item.name);
  return enumType?.values || [];
}

function getSourceVariantAlternatives(item, source) {
  const file = state.files.find(f => f.name === source);
  if (!file) return item.alternatives || [];
  const variantType = file.dataTypes.variant?.find(v => v.name === item.name);
  return variantType?.alternatives || [];
}

function areEnumValuesEqual(values1, values2) {
  if (!values1 && !values2) return true;
  if (!values1 || !values2) return false;
  if (values1.length !== values2.length) return false;
  const sorted1 = [...values1].sort((a, b) => a.name.localeCompare(b.name));
  const sorted2 = [...values2].sort((a, b) => a.name.localeCompare(b.name));
  return sorted1.every((v1, i) => v1.name === sorted2[i].name && v1.value === sorted2[i].value);
}

function areVariantAlternativesEqual(alt1, alt2) {
  if (!alt1 && !alt2) return true;
  if (!alt1 || !alt2) return false;
  if (alt1.length !== alt2.length) return false;
  const sorted1 = [...alt1].sort((a, b) => a.label.localeCompare(b.label));
  const sorted2 = [...alt2].sort((a, b) => a.label.localeCompare(b.label));
  return sorted1.every((a1, i) => a1.label === sorted2[i].label && a1.dataType === sorted2[i].dataType);
}

// ============================================================================
// DETAIL RENDERING
// ============================================================================

function getTypeIcon(type) {
  const icons = { basic: '🔵', simple: '🔷', array: '🟠', fixed: '🔴', enum: '🟣', variant: '🟩' };
  return icons[type] || '⚪';
}

function renderDetail(item, type, parents = []) {
  if (!item) return '';
  let html = '';
  if (type === 'object' || type === 'interaction') {
    const props = type === 'object' ? item.attributes : item.parameters;
    const isObject = type === 'object';
    if (parents.length > 0) {
      html += '<div class="detail-section"><div class="breadcrumb">';
      parents.forEach((p, idx) => {
        html += `<span class="breadcrumb-item clickable-item" onclick="showDetail('${p.name.replace(/'/g, "\\'")}', '${type}', true); return false;">${p.name}</span>`;
        if (idx < parents.length - 1) html += ' <span class="breadcrumb-sep">›</span> ';
      });
      html += ` <span class="breadcrumb-sep">›</span> <span class="breadcrumb-current">${item.name}</span>`;
      html += '</div></div>';
    }
    html += '<div class="detail-section"><h3>Class Information</h3><table class="property-table">';
    html += `<tr><th>Name</th><td>${item.name}${item.notes ? ' ' + renderNoteIcon(item.notes) : ''}</td></tr>`;
    if (item.sharing) html += `<tr><th>Sharing</th><td>${item.sharing}</td></tr>`;
    if (item.semantics) html += `<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.semantics}</td></tr>`;
    if (item.parent) html += `<tr><th>Parent</th><td>${item.parent}</td></tr>`;
    // Appspaces row
    if (state.appspace) {
      const apps = findAppspaceForClass(item.name, type);
      if (apps && apps.length > 0) {
        html += '<tr><th>Appspaces</th><td><ul class="apps-list">';
        apps.forEach(a => { html += `<li>${a}</li>`; });
        html += '</ul></td></tr>';
      }
    }
    if (type === 'interaction') {
      if (item.dimensions && item.dimensions.length > 0) {
        html += '<tr><th>Dimensions</th><td>';
        item.dimensions.forEach(d => { html += `<div>${d}</div>`; });
        html += '</td></tr>';
      }
      if (item.transportation) html += `<tr><th>Transportation</th><td><span class="clickable-item" onclick="showDetail('${item.transportation}', 'trans', true)">${item.transportation}</span></td></tr>`;
      if (item.order) html += `<tr><th>Order</th><td>${item.order}</td></tr>`;
    }
const sources = item._sources || (item._source ? [item._source] : []);
    if (sources.length > 0) {
      html += `<tr><th>Module${sources.length > 1 ? 's' : ''}</th><td><ul style="list-style:none;margin:0;padding:0;">`;
      html += sources.map(s => `<li><span class="clickable-item" onclick="switchToModule('${s.replace(/'/g, "\\'")}')">${s}</span></li>`).join('');
      html += `</ul></td></tr>`;
    }
    html += '</table></div>';
    
    if (props && props.length > 0) {
      html += '<h4 style="margin:12px 0 8px">' + (isObject ? 'Attributes' : 'Parameters') + '</h4>';
      html += '<table class="property-table"><tr><th>Name</th><th>Data Type</th><th>Sharing</th><th>Semantics</th>' + (isObject ? '<th>Update Type</th><th>Update Condition</th><th>Ownership</th><th>Transportation</th><th>Order</th>' : '<th>Order</th>') + '</tr>';
      props.forEach(p => {
        const dataTypeLink = p.dataType ? `<span class="clickable-item" onclick="showDataType('${p.dataType.replace(/'/g, "\\'")}', getPreferredType('${p.dataType.replace(/'/g, "\\'")}'))">${p.dataType}</span>` : '';
        html += `<tr><td>${p.name}${p.notes ? ' ' + renderNoteIcon(p.notes) : ''}</td><td>${dataTypeLink}</td><td>${p.sharing || ''}</td><td style="max-width:300px;word-wrap:break-word;white-space:pre-wrap;">${p.semantics || ''}</td>`;
        if (isObject) {
          html += `<td>${p.updateType || ''}</td><td>${p.updateCondition || ''}</td><td>${p.ownership || ''}</td><td>${p.transportation || ''}</td><td>${p.order || ''}</td>`;
        } else {
          html += `<td>${p.order || ''}</td>`;
        }
        html += '</tr>';
      });
      html += '</table>';
    }
    
    const classUsages = type === 'object' ? 
      findDataTypeUsages(item.name).filter(u => u.location.startsWith('Object:')) :
      findDataTypeUsages(item.name).filter(u => u.location.startsWith('Interaction:'));
    if (classUsages.length > 0) {
      html += '<h4 style="margin:12px 0 8px">Used By</h4><table class="property-table"><tr><th>Name</th><th>Type</th><th>Location</th></tr>';
      classUsages.forEach(u => { html += `<tr><td><span class="clickable-item" onclick="showDetail('${u.name}', '${u.type}', true)">${u.name}</span></td><td>${u.type === 'object' ? 'Object Class' : 'Interaction Class'}</td><td>${u.location}</td></tr>`; });
      html += '</table>';
    }
  } else if (type === 'basic') {
    html += '<div class="detail-section"><h3>Basic Data Type</h3><table class="property-table">';
    html += `<tr><th>Name</th><td>${item.name}${item.notes ? ' ' + renderNoteIcon(item.notes) : ''}</td></tr>`;
    if (item.size) html += `<tr><th>Size</th><td>${item.size}</td></tr>`;
    if (item.encoding) html += `<tr><th>Encoding</th><td>${item.encoding}</td></tr>`;
    if (item.endian) html += `<tr><th>Endian</th><td>${item.endian}</td></tr>`;
    if (item.interpretation) html += `<tr><th>Interpretation</th><td>${item.interpretation}</td></tr>`;
    if (item.semantics) html += `<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.semantics}</td></tr>`;
    const sources = item._sources || (item._source ? [item._source] : []);
    if (sources.length > 0) {
      html += `<tr><th>Module${sources.length > 1 ? 's' : ''}</th><td><ul style="list-style:none;margin:0;padding:0;">`;
      html += sources.map(s => `<li><span class="clickable-item" onclick="switchToModule('${s.replace(/'/g, "\\'")}')">${s}</span></li>`).join('');
      html += `</ul></td></tr>`;
    }
    html += '</table></div>';
    
    const basicUsages = findDataTypeUsages(item.name);
    if (basicUsages.length > 0) {
      html += '<h4 style="margin:12px 0 8px">Used By</h4><table class="property-table"><tr><th>Name</th><th>Type</th><th>Location</th></tr>';
      const makeLink = (u) => {
        if (u.type === 'object' || u.type === 'interaction') {
          return `<span class="clickable-item" onclick="showDetail('${u.name}', '${u.type}', true)">${u.name}</span>`;
        }
        return `<span class="clickable-item" onclick="showDataType('${u.name}', '${u.type}')">${u.name}</span>`;
      };
      const typeLabels = { simple: 'Simple', array: 'Array', fixed: 'Fixed', variant: 'Variant', enum: 'Enum', object: 'Object Class', interaction: 'Interaction Class' };
      basicUsages.forEach(u => { html += `<tr><td>${makeLink(u)}</td><td>${typeLabels[u.type]}</td><td>${u.location}</td></tr>`; });
      html += '</table>';
    }
  } else if (type === 'simple') {
    html += '<div class="detail-section"><h3>Simple Data Type</h3><table class="property-table">';
    html += `<tr><th>Name</th><td>${item.name}${item.notes ? ' ' + renderNoteIcon(item.notes) : ''}</td></tr>`;
    if (item.representation) html += `<tr><th>Representation</th><td><span class="clickable-item" onclick="showDataType('${item.representation}', 'basic')">${item.representation}</span></td></tr>`;
    if (item.units) html += `<tr><th>Units</th><td>${item.units}</td></tr>`;
    if (item.resolution) html += `<tr><th>Resolution</th><td>${item.resolution}</td></tr>`;
    if (item.accuracy) html += `<tr><th>Accuracy</th><td>${item.accuracy}</td></tr>`;
    if (item.semantics) html += `<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.semantics}</td></tr>`;
const sources = item._sources || (item._source ? [item._source] : []);
    if (sources.length > 0) {
      html += `<tr><th>Module${sources.length > 1 ? 's' : ''}</th><td><ul style="list-style:none;margin:0;padding:0;">`;
      html += sources.map(s => `<li><span class="clickable-item" onclick="switchToModule('${s.replace(/'/g, "\\'")}')">${s}</span></li>`).join('');
      html += `</ul></td></tr>`;
    }
    html += '</table></div>';
    
    const simpleUsages = findDataTypeUsages(item.name);
    if (simpleUsages.length > 0) {
      html += '<h4 style="margin:12px 0 8px">Used By</h4><table class="property-table"><tr><th>Name</th><th>Type</th><th>Location</th></tr>';
      const makeLink = (u) => {
        if (u.type === 'object' || u.type === 'interaction') {
          return `<span class="clickable-item" onclick="showDetail('${u.name}', '${u.type}', true)">${u.name}</span>`;
        }
        return `<span class="clickable-item" onclick="showDataType('${u.name}', '${u.type}')">${u.name}</span>`;
      };
      const typeLabels = { simple: 'Simple', array: 'Array', fixed: 'Fixed', variant: 'Variant', enum: 'Enum', object: 'Object Class', interaction: 'Interaction Class' };
      simpleUsages.forEach(u => { html += `<tr><td>${makeLink(u)}</td><td>${typeLabels[u.type]}</td><td>${u.location}</td></tr>`; });
      html += '</table>';
    }
  } else if (type === 'array') {
    html += '<div class="detail-section"><h3>Array Data Type</h3><table class="property-table">';
    html += `<tr><th>Name</th><td>${item.name}${item.notes ? ' ' + renderNoteIcon(item.notes) : ''}</td></tr>`;
    html += `<tr><th>Data Type</th><td>${item.dataType ? '<span class="clickable-item" onclick="showDataType(\'' + item.dataType + '\', getPreferredType(\'' + item.dataType + '\'))">' + item.dataType + '</span>' : ''}</td></tr>`;
    if (item.cardinality) html += `<tr><th>Cardinality</th><td>${item.cardinality}</td></tr>`;
    if (item.encoding) html += `<tr><th>Encoding</th><td>${item.encoding}</td></tr>`;
    if (item.semantics) html += `<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.semantics}</td></tr>`;
    const sources = item._sources || (item._source ? [item._source] : []);
    if (sources.length > 0) {
      html += `<tr><th>Module${sources.length > 1 ? 's' : ''}</th><td><ul style="list-style:none;margin:0;padding:0;">`;
      html += sources.map(s => `<li><span class="clickable-item" onclick="switchToModule('${s.replace(/'/g, "\\'")}')">${s}</span></li>`).join('');
      html += `</td></tr>`;
    }
    html += '</table></div>';
    
    const arrayUsages = findDataTypeUsages(item.name);
    if (arrayUsages.length > 0) {
      html += '<h4 style="margin:12px 0 8px">Used By</h4><table class="property-table"><tr><th>Name</th><th>Type</th><th>Location</th></tr>';
      const makeLink = (u) => {
        if (u.type === 'object' || u.type === 'interaction') {
          return `<span class="clickable-item" onclick="showDetail('${u.name}', '${u.type}', true)">${u.name}</span>`;
        }
        return `<span class="clickable-item" onclick="showDataType('${u.name}', '${u.type}')">${u.name}</span>`;
      };
      const typeLabels = { simple: 'Simple', array: 'Array', fixed: 'Fixed', variant: 'Variant', enum: 'Enum', object: 'Object Class', interaction: 'Interaction Class' };
      arrayUsages.forEach(u => { html += `<tr><td>${makeLink(u)}</td><td>${typeLabels[u.type]}</td><td>${u.location}</td></tr>`; });
      html += '</table>';
    }
  } else if (type === 'fixed') {
    html += '<div class="detail-section"><h3>Fixed Record Data Type</h3><table class="property-table">';
    html += `<tr><th>Name</th><td>${item.name}${item.notes ? ' ' + renderNoteIcon(item.notes) : ''}</td></tr>`;
    if (item.encoding) html += `<tr><th>Encoding</th><td>${item.encoding}</td></tr>`;
    if (item.semantics) html += `<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.semantics}</td></tr>`;
const sources = item._sources || (item._source ? [item._source] : []);
    if (sources.length > 0) {
      html += `<tr><th>Module${sources.length > 1 ? 's' : ''}</th><td><ul style="list-style:none;margin:0;padding:0;">`;
      html += sources.map(s => `<li><span class="clickable-item" onclick="switchToModule('${s.replace(/'/g, "\\'")}')">${s}</span></li>`).join('');
      html += `</td></tr>`;
    }
    html += '</table></div>';
    if (item.fields && item.fields.length > 0) {
      html += '<h4 style="margin:12px 0 8px">Fields (original order)</h4><table class="property-table"><tr><th>Name</th><th>Data Type</th><th>Encoding</th><th>Semantics</th></tr>';
      item.fields.forEach(f => { html += `<tr><td>${f.name}${f.notes ? ' ' + renderNoteIcon(f.notes) : ''}</td><td>${f.dataType ? '<span class="clickable-item" onclick="showDataType(\'' + f.dataType + '\', getPreferredType(\'' + f.dataType + '\'))">' + f.dataType + '</span>' : ''}</td><td>${f.encoding || ''}</td><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${f.semantics || ''}</td></tr>`; });
      html += '</table>';
    }
    const fixedUsages = findDataTypeUsages(item.name);
    if (fixedUsages.length > 0) {
      html += '<h4 style="margin:12px 0 8px">Used By</h4><table class="property-table"><tr><th>Name</th><th>Type</th><th>Location</th></tr>';
      const makeLink = (u) => {
        if (u.type === 'object' || u.type === 'interaction') {
          return `<span class="clickable-item" onclick="showDetail('${u.name}', '${u.type}', true)">${u.name}</span>`;
        }
        return `<span class="clickable-item" onclick="showDataType('${u.name}', '${u.type}')">${u.name}</span>`;
      };
      const typeLabels = { simple: 'Simple', array: 'Array', fixed: 'Fixed', variant: 'Variant', enum: 'Enum', object: 'Object Class', interaction: 'Interaction Class' };
      fixedUsages.forEach(u => { html += `<tr><td>${makeLink(u)}</td><td>${typeLabels[u.type]}</td><td>${u.location}</td></tr>`; });
      html += '</table>';
    }
  } else if (type === 'enum') {
    html += '<div class="detail-section"><h3>Enumerated Data Type</h3><table class="property-table">';
    html += `<tr><th>Name</th><td>${item.name}</td></tr>`;
    if (item.representation) html += `<tr><th>Representation</th><td><span class="clickable-item" onclick="showDataType('${item.representation}', 'basic')">${item.representation}</span></td></tr>`;
    if (item.semantics) html += `<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.semantics}</td></tr>`;
    const sources = item._sources || (item._source ? [item._source] : []);
    if (sources.length > 0) {
      html += `<tr><th>Module${sources.length > 1 ? 's' : ''}</th><td><ul style="list-style:none;margin:0;padding:0;">`;
      html += sources.map(s => `<li><span class="clickable-item" onclick="switchToModule('${s.replace(/'/g, "\\'")}')">${s}</span></li>`).join('');
      html += `</td></tr>`;
    }
    html += '</table></div>';
    if (item.values && item.values.length > 0) {
      const sortedValues = state.sortEnabled ? [...item.values].sort((a, b) => a.value - b.value) : item.values;
      html += '<h4 style="margin:12px 0 8px">Enumerators</h4><table class="property-table"><tr><th>Name</th><th>Value</th></tr>';
      sortedValues.forEach(v => { html += `<tr><td>${v.name}${v.notes ? ' ' + renderNoteIcon(v.notes) : ''}</td><td>${v.value}</td></tr>`; });
      html += '</table>';
    }
    
    const enumUsages = findDataTypeUsages(item.name);
    if (enumUsages.length > 0) {
      html += '<h4 style="margin:12px 0 8px">Used By</h4><table class="property-table"><tr><th>Name</th><th>Type</th><th>Location</th></tr>';
      const makeLink = (u) => {
        if (u.type === 'object' || u.type === 'interaction') {
          return `<span class="clickable-item" onclick="showDetail('${u.name}', '${u.type}', true)">${u.name}</span>`;
        }
        return `<span class="clickable-item" onclick="showDataType('${u.name}', '${u.type}')">${u.name}</span>`;
      };
      const typeLabels = { simple: 'Simple', array: 'Array', fixed: 'Fixed', variant: 'Variant', enum: 'Enum', object: 'Object Class', interaction: 'Interaction Class' };
      enumUsages.forEach(u => { html += `<tr><td>${makeLink(u)}</td><td>${typeLabels[u.type]}</td><td>${u.location}</td></tr>`; });
      html += '</table>';
    }
  } else if (type === 'variant') {
    html += '<div class="detail-section"><h3>Variant Record Data Type</h3><table class="property-table">';
    html += `<tr><th>Name</th><td>${item.name}</td></tr>`;
    if (item.discriminant) html += `<tr><th>Discriminant</th><td>${item.discriminant}</td></tr>`;
    if (item.dataType) html += `<tr><th>Discriminant Type</th><td>${item.dataType}</td></tr>`;
    if (item.encoding) html += `<tr><th>Encoding</th><td>${item.encoding}</td></tr>`;
    if (item.semantics) html += `<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.semantics}</td></tr>`;
    const sources = item._sources || (item._source ? [item._source] : []);
    if (sources.length > 0) {
      html += `<tr><th>Module${sources.length > 1 ? 's' : ''}</th><td><ul style="list-style:none;margin:0;padding:0;">`;
      html += sources.map(s => `<li><span class="clickable-item" onclick="switchToModule('${s.replace(/'/g, "\\'")}')">${s}</span></li>`).join('');
      html += `</td></tr>`;
    }
    html += '</table></div>';
    if (item.alternatives && item.alternatives.length > 0) {
      html += '<h4 style="margin:12px 0 8px">Alternatives</h4><table class="property-table"><tr><th>Name</th><th>Enumerator</th><th>Data Type</th><th>Semantics</th></tr>';
      item.alternatives.forEach(a => { html += `<tr><td>${a.label}${a.notes ? ' ' + renderNoteIcon(a.notes) : ''}</td><td>${a.enumerator || ''}</td><td>${a.dataType ? '<span class="clickable-item" onclick="showDataType(\'' + a.dataType + '\', getPreferredType(\'' + a.dataType + '\'))">' + a.dataType + '</span>' : ''}</td><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${a.semantics || ''}</td></tr>`; });
      html += '</table>';
    }
    
    const variantUsages = findDataTypeUsages(item.name);
    if (variantUsages.length > 0) {
      html += '<h4 style="margin:12px 0 8px">Used By</h4><table class="property-table"><tr><th>Name</th><th>Type</th><th>Location</th></tr>';
      const makeLink = (u) => {
        if (u.type === 'object' || u.type === 'interaction') {
          return `<span class="clickable-item" onclick="showDetail('${u.name}', '${u.type}', true)">${u.name}</span>`;
        }
        return `<span class="clickable-item" onclick="showDataType('${u.name}', '${u.type}')">${u.name}</span>`;
      };
      const typeLabels = { simple: 'Simple', array: 'Array', fixed: 'Fixed', variant: 'Variant', enum: 'Enum', object: 'Object Class', interaction: 'Interaction Class' };
      variantUsages.forEach(u => { html += `<tr><td>${makeLink(u)}</td><td>${typeLabels[u.type]}</td><td>${u.location}</td></tr>`; });
      html += '</table>';
    }
  } else if (type === 'ident') {
    html += '<div class="detail-section"><h3>Model Identification</h3><table class="property-table">';
    if (item.name) html += `<tr><th>Name</th><td>${item.name}</td></tr>`;
    if (item.type) html += `<tr><th>Type</th><td>${item.type}</td></tr>`;
    if (item.version) html += `<tr><th>Version</th><td>${item.version}</td></tr>`;
    if (item.modificationDate) html += `<tr><th>Modification Date</th><td>${item.modificationDate}</td></tr>`;
    if (item.securityClassification) html += `<tr><th>Security Classification</th><td>${item.securityClassification}</td></tr>`;
    if (item.purpose) html += `<tr><th>Purpose</th><td>${item.purpose}</td></tr>`;
    if (item.applicationDomain) html += `<tr><th>Application Domain</th><td>${item.applicationDomain}</td></tr>`;
    if (item.description) html += `<tr><th>Description</th><td>${item.description}</td></tr>`;
    html += '</table></div>';
    if (item.poc) {
      html += '<div class="detail-section"><h3>Point of Contact</h3><table class="property-table">';
      if (item.poc.pocType) html += `<tr><th>Type</th><td>${item.poc.pocType}</td></tr>`;
      if (item.poc.pocName) html += `<tr><th>Name</th><td>${item.poc.pocName}</td></tr>`;
      if (item.poc.pocOrg) html += `<tr><th>Organization</th><td>${item.poc.pocOrg}</td></tr>`;
      if (item.poc.pocTelephone) html += `<tr><th>Telephone</th><td>${item.poc.pocTelephone}</td></tr>`;
      if (item.poc.pocEmail) html += `<tr><th>Email</th><td>${item.poc.pocEmail}</td></tr>`;
      html += '</table></div>';
    }
  } else if (type === 'dims') {
    html += '<div class="detail-section"><h3>Dimension</h3><table class="property-table">';
    html += `<tr><th>Name</th><td>${item.name}</td></tr>`;
    if (item.isComplex && item.rows && item.rows.length > 0) {
      item.rows.forEach(r => { html += `<tr><th>${r.key}</th><td>${r.value}</td></tr>`; });
    }
    html += '</table></div>';
  } else if (type === 'trans') {
    html += '<div class="detail-section"><h3>Transportation</h3><table class="property-table">';
    html += `<tr><th>Name</th><td>${item.name}</td></tr>`;
    if (item.reliable) html += `<tr><th>Reliable</th><td>${item.reliable}</td></tr>`;
    if (item.semantics) html += `<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.semantics}</td></tr>`;
    if (item.rows && item.rows.length > 0) {
      item.rows.forEach(r => { html += `<tr><th>${r.key}</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${r.value}</td></tr>`; });
    }
    html += '</table></div>';
  } else if (type === 'notes') {
    html += '<div class="detail-section"><h3>Note</h3><table class="property-table">';
    html += `<tr><th>Label</th><td>${item.name}</td></tr>`;
    if (item.semantics) html += `<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.semantics}</td></tr>`;
    if (item.rows && item.rows.length > 0) {
      item.rows.forEach(r => { html += `<tr><th>${r.key}</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${r.value}</td></tr>`; });
    }
    html += '</table></div>';
    
    const noteUsages = findNoteUsages(item.name);
    if (noteUsages.length > 0) {
      html += '<h4 style="margin:12px 0 8px">Used By</h4><table class="property-table"><tr><th>Name</th><th>Type</th><th>Location</th></tr>';
      const typeLabels = { object: 'Object Class', interaction: 'Interaction Class', simple: 'Simple', array: 'Array', fixed: 'Fixed', enum: 'Enumeration', variant: 'Variant' };
      noteUsages.forEach(u => {
        const makeLink = () => {
          if (u.type === 'object' || u.type === 'interaction') {
            return `<span class="clickable-item" onclick="showDetail('${u.name.replace(/'/g, "\\'")}', '${u.type}', true)">${u.name}</span>`;
          }
          return `<span class="clickable-item" onclick="showDataType('${u.name.replace(/'/g, "\\'")}', '${u.type}')">${u.name}</span>`;
        };
        html += `<tr><td>${makeLink()}</td><td>${typeLabels[u.type] || u.type}</td><td>${u.location}</td></tr>`;
      });
      html += '</table>';
    }
  } else if (type === 'switches') {
    html += '<div class="detail-section"><h3>Switch</h3><table class="property-table">';
    html += `<tr><th>Name</th><td>${item.name}</td></tr>`;
    if (item.value) html += `<tr><th>Value</th><td>${item.value}</td></tr>`;
    if (item.semantics) html += `<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.semantics}</td></tr>`;
    html += '</table></div>';
  } else if (type === 'tags') {
    html += '<div class="detail-section"><h3>Tag</h3><table class="property-table">';
    html += `<tr><th>Name</th><td>${item.name}</td></tr>`;
    if (item.dataType) html += `<tr><th>Data Type</th><td>${item.dataType}</td></tr>`;
    if (item.semantics) html += `<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.semantics}</td></tr>`;
    html += '</table></div>';
  } else if (type === 'time') {
    html += '<div class="detail-section"><h3>Time Configuration</h3><table class="property-table">';
    if (item.timeStamp) {
      html += `<tr><th>Time Stamp Data Type</th><td>${item.timeStamp.dataType || ''}</td></tr>`;
      if (item.timeStamp.semantics) html += `<tr><th>Time Stamp Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.timeStamp.semantics}</td></tr>`;
    }
    if (item.lookahead) {
      html += `<tr><th>Lookahead Data Type</th><td>${item.lookahead.dataType || ''}</td></tr>`;
      if (item.lookahead.semantics) html += `<tr><th>Lookahead Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">${item.lookahead.semantics}</td></tr>`;
    }
    html += '</table></div>';
  }
  return html;
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

function findBasicTypeUsages(basicTypeName) {
  const usages = [];
  if (!state.mergedFOM) return usages;
  
  // Check Simple data types
  state.mergedFOM.dataTypes.simple?.forEach(s => {
    if (s.representation === basicTypeName) {
      usages.push({ name: s.name, type: 'simple', location: 'Simple Data Type' });
    }
  });
  
  // Check Array data types
  state.mergedFOM.dataTypes.array?.forEach(a => {
    if (a.dataType === basicTypeName) {
      usages.push({ name: a.name, type: 'array', location: 'Array Data Type' });
    }
  });
  
  // Check Fixed record fields
  state.mergedFOM.dataTypes.fixed?.forEach(f => {
    f.fields?.forEach(field => {
      if (field.dataType === basicTypeName) {
        usages.push({ name: f.name, type: 'fixed', location: `Fixed Record: ${field.name}` });
      }
    });
  });
  
  // Check Variant record alternatives
  state.mergedFOM.dataTypes.variant?.forEach(v => {
    v.alternatives?.forEach(alt => {
      if (alt.dataType === basicTypeName) {
        usages.push({ name: v.name, type: 'variant', location: `Variant Record: ${alt.label}` });
      }
    });
  });
  
  // Check Enumeration representation
  state.mergedFOM.dataTypes.enum?.forEach(e => {
    if (e.representation === basicTypeName) {
      usages.push({ name: e.name, type: 'enum', location: 'Enumerated Type' });
    }
  });
  
  // Check Object class attributes
  state.mergedFOM.objectClasses?.forEach(obj => {
    obj.attributes?.forEach(attr => {
      if (attr.dataType === basicTypeName) {
        usages.push({ name: obj.name, type: 'object', location: `Object: ${attr.name}` });
      }
    });
  });
  
  // Check Interaction class parameters
  state.mergedFOM.interactionClasses?.forEach(int => {
    int.parameters?.forEach(param => {
      if (param.dataType === basicTypeName) {
        usages.push({ name: int.name, type: 'interaction', location: `Interaction: ${param.name}` });
      }
    });
  });
  
  return usages;
}

function findNoteByName(noteName) {
  if (!noteName) return null;
  for (const f of state.files) {
    if (f.notes) {
      const found = f.notes.find(n => (typeof n === 'string' ? n : n.name) === noteName);
      if (found) return found;
    }
  }
  return null;
}

function renderNoteIcon(noteNames) {
  if (!noteNames) return '';
  const notes = noteNames.split(' ').filter(n => n.trim());
  if (notes.length === 0) return '';
  
  let html = '';
  notes.forEach(noteName => {
    const note = findNoteByName(noteName);
    if (!note) {
      html += `<span class="note-icon" title="Note not found: ${noteName}">⚠️</span>`;
    } else {
      const semantics = typeof note === 'string' ? '' : (note.semantics || '');
      const tooltip = semantics ? `${noteName}: ${semantics.substring(0, 100)}${semantics.length > 100 ? '...' : ''}` : noteName;
      html += `<span class="note-icon clickable-item" onclick="showDetail('${noteName.replace(/'/g, "\\'")}', 'notes', true)" title="${tooltip.replace(/"/g, '&quot;')}">📝</span>`;
    }
  });
  return html;
}

function findNoteUsages(noteName) {
  if (!noteName || !state.mergedFOM) return [];
  const usages = [];
  
  // Check Object classes
  state.mergedFOM.objectClasses?.forEach(obj => {
    if (obj.notes === noteName) {
      usages.push({ name: obj.name, type: 'object', location: 'Class' });
    }
    obj.attributes?.forEach(attr => {
      if (attr.notes === noteName) {
        usages.push({ name: obj.name, type: 'object', location: `Attribute: ${attr.name}` });
      }
    });
  });
  
  // Check Interaction classes
  state.mergedFOM.interactionClasses?.forEach(int => {
    if (int.notes === noteName) {
      usages.push({ name: int.name, type: 'interaction', location: 'Class' });
    }
    int.parameters?.forEach(param => {
      if (param.notes === noteName) {
        usages.push({ name: int.name, type: 'interaction', location: `Parameter: ${param.name}` });
      }
    });
  });
  
  // Check Simple data types
  state.mergedFOM.dataTypes?.simple?.forEach(s => {
    if (s.notes === noteName) {
      usages.push({ name: s.name, type: 'simple', location: 'Simple Data Type' });
    }
  });
  
  // Check Array data types
  state.mergedFOM.dataTypes?.array?.forEach(a => {
    if (a.notes === noteName) {
      usages.push({ name: a.name, type: 'array', location: 'Array Data Type' });
    }
  });
  
  // Check Fixed data types
  state.mergedFOM.dataTypes?.fixed?.forEach(f => {
    if (f.notes === noteName) {
      usages.push({ name: f.name, type: 'fixed', location: 'Fixed Record Data Type' });
    }
    f.fields?.forEach(field => {
      if (field.notes === noteName) {
        usages.push({ name: f.name, type: 'fixed', location: `Field: ${field.name}` });
      }
    });
  });
  
  // Check Enumeration data types
  state.mergedFOM.dataTypes?.enum?.forEach(e => {
    if (e.notes === noteName) {
      usages.push({ name: e.name, type: 'enum', location: 'Enumerated Data Type' });
    }
    e.values?.forEach(v => {
      if (v.notes === noteName) {
        usages.push({ name: e.name, type: 'enum', location: `Enumerator: ${v.name}` });
      }
    });
  });
  
  // Check Variant data types
  state.mergedFOM.dataTypes?.variant?.forEach(v => {
    if (v.notes === noteName) {
      usages.push({ name: v.name, type: 'variant', location: 'Variant Record Data Type' });
    }
    v.alternatives?.forEach(alt => {
      if (alt.notes === noteName) {
        usages.push({ name: v.name, type: 'variant', location: `Alternative: ${alt.label}` });
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
  
  // Check Variant record alternatives
  state.mergedFOM.dataTypes.variant?.forEach(v => {
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
  
  return usages;
}

// ============================================================================
// TREE RENDERING
// ============================================================================

function buildClassTree(classes, sortDir) {
  const roots = [];
  const map = {};
  classes.forEach(c => { map[c.name] = { ...c, children: [] }; });
  classes.forEach(c => {
    const node = map[c.name];
    if (c.parent && map[c.parent]) { map[c.parent].children.push(node); }
    else { roots.push(node); }
  });
  const sortTree = nodes => { 
    if (sortDir === 'asc') nodes.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortDir === 'desc') nodes.sort((a, b) => b.name.localeCompare(a.name));
    nodes.forEach(n => sortTree(n.children)); 
  };
  sortTree(roots);
  return roots;
}

function renderTree(nodes, type, depth = 0) {
  let html = '';
  nodes.forEach(node => {
    const itemCount = type === 'object' ? node.attributes?.length || 0 : node.parameters?.length || 0;
    const hasChildren = node.children && node.children.length > 0;
    const isRoot = depth === 0;
    html += `<div class="tree-item" data-name="${node.name}" data-type="${type}" data-depth="${depth}" style="padding-left:${depth * 20}px">
      ${hasChildren ? `<span class="tree-toggle" data-expanded="${isRoot}">${isRoot ? '▼' : '▶'}</span>` : '<span class="tree-toggle"></span>'}
      <span class="name" title="${node.name}">${node.name.split('.').pop()}</span>
      ${itemCount > 0 ? `<span class="count">${itemCount}</span>` : ''}
    </div>`;
    if (hasChildren) { html += `<div class="tree-children${isRoot ? '' : ' collapsed'}">${renderTree(node.children, type, depth + 1)}</div>`; }
  });
  return html;
}

function renderDataTypeList(type) {
  if (!state.mergedFOM) return '<div class="empty-state">No data loaded. Load FOM files to view data types.</div>';
  const items = state.mergedFOM.dataTypes[type];
  const hasConflict = type === 'enum' || type === 'variant';
  if (!items || items.length === 0) return '<div class="empty-state">No ' + type + ' data types in loaded FOM files.</div>';
  const sortedItems = state.sortEnabled === 'asc' ? [...items].sort((a, b) => a.name.localeCompare(b.name)) : state.sortEnabled === 'desc' ? [...items].sort((a, b) => b.name.localeCompare(a.name)) : items;
  let html = '';
  sortedItems.forEach(item => {
    const conflict = hasConflict ? state.conflicts.find(c => c.type === type && c.name === item.name) : null;
    html += `<div class="tree-item" data-name="${item.name}" data-type="${type}">
      <span class="icon">${getTypeIcon(type)}</span>
      <span class="name">${item.name}</span>
      ${conflict ? '<span class="warning-icon" title="Defined in multiple modules">⚠</span>' : ''}
    </div>`;
  });
  return html;
}

// ============================================================================
// NAVIGATION (showDetail, showDataType, showModuleDetails)
// ============================================================================

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
    'basic': 'datatypes', 'simple': 'datatypes', 'array': 'datatypes', 'fixed': 'datatypes', 'enum': 'datatypes', 'variant': 'datatypes'
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
      document.getElementById('dataTypeTabs').style.display = 'flex';
      document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
      const subTabEl = document.querySelector(`.subtab[data-subtab="${type}"]`);
      if (subTabEl) subTabEl.classList.add('active');
      state.currentSubTab = type;
    } else {
      document.getElementById('dataTypeTabs').style.display = 'none';
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
    state.history.push({ tab: prevTab, subTab: prevSubTab, selected: currentSelected, detail: document.getElementById('detailHeader').style.display });
  }
  state.selectedItem = { name, type };
  const header = document.getElementById('detailHeader');
  const welcome = document.getElementById('welcomeScreen');
  const title = document.getElementById('detailTitle');
  const meta = document.getElementById('detailMeta');
  const body = document.getElementById('detailBody');
  welcome.style.display = 'none';
  header.style.display = 'block';
  
  const backBtn = document.getElementById('backBtn');
  backBtn.style.display = state.history.length > 0 ? 'inline-block' : 'none';
  
  let item, source = '';
  if (type === 'object') { item = state.mergedFOM.objectClasses.find(c => c.name === name); source = item?._source || ''; }
  else if (type === 'interaction') { item = state.mergedFOM.interactionClasses.find(c => c.name === name); source = item?._source || ''; }
  else if (type === 'ident') {
    const file = state.files.find(f => f.name === name);
    item = file?.identification; source = name;
  } else if (type === 'dims') {
    let dimItem = null;
    for (const f of state.files) {
      if (f.dimensions) {
        const found = f.dimensions.find(d => d.name === name);
        if (found) { dimItem = found; break; }
      }
    }
    item = dimItem || { name }; source = name;
  } else if (type === 'trans') {
    let transItem = null;
    const trimmedName = name.trim();
    if (state.mergedFOM && state.mergedFOM.transportations) {
      transItem = state.mergedFOM.transportations.find(t => t.name.trim() === trimmedName);
    }
    if (!transItem) {
      for (const f of state.files) {
        if (f.transportations) {
          const found = f.transportations.find(t => t.name.trim() === trimmedName);
          if (found) { transItem = found; break; }
        }
      }
    }
    item = transItem || { name: trimmedName }; source = name;
  } else if (type === 'notes') {
    let noteItem = null;
    for (const f of state.files) {
      if (f.notes) {
        const found = f.notes.find(n => (typeof n === 'string' ? n : n.name) === name);
        if (found) { noteItem = found; break; }
      }
    }
    item = noteItem || { name }; source = name;
  } else if (type === 'switches') {
    let switchItem = null;
    if (state.mergedFOM && state.mergedFOM.switches) {
      switchItem = state.mergedFOM.switches.find(s => s.name.trim() === name.trim());
    }
    if (!switchItem) {
      for (const f of state.files) {
        if (f.switches) {
          const found = f.switches.find(s => s.name.trim() === name.trim());
          if (found) { switchItem = found; break; }
        }
      }
    }
    item = switchItem || { name }; source = name;
  } else if (type === 'tags') {
    let tagItem = null;
    if (state.mergedFOM && state.mergedFOM.tags) {
      tagItem = state.mergedFOM.tags.find(t => t.name.trim() === name.trim());
    }
    if (!tagItem) {
      for (const f of state.files) {
        if (f.tags) {
          const found = f.tags.find(t => t.name.trim() === name.trim());
          if (found) { tagItem = found; break; }
        }
      }
    }
    item = tagItem || { name }; source = name;
  } else if (type === 'time') {
    item = state.mergedFOM?.time || {}; source = 'Time Configuration';
  }
  else { item = state.mergedFOM.dataTypes[type]?.find(d => d.name === name); }
  title.textContent = name;
  meta.textContent = source;
  
if (type === 'object') {
    const allClasses = state.mergedFOM.objectClasses;
    const parentChain = [];
    let current = allClasses.find(c => c.name === name);
    while (current && current.parent) {
      const parentClass = allClasses.find(c => c.name === current.parent);
      if (parentClass) {
        parentChain.push(parentClass);
        current = parentClass;
      } else {
        break;
      }
    }
    parentChain.reverse();
    body.innerHTML = renderDetail(item, type, parentChain);
  } else if (type === 'interaction') {
    const allClasses = state.mergedFOM.interactionClasses;
    const current = allClasses.find(c => c.name === name);
    const parentChain = [];
    let iter = current;
    while (iter && iter.parent) {
      const parentClass = allClasses.find(c => c.name === iter.parent);
      if (parentClass) {
        parentChain.push(parentClass);
        iter = parentClass;
      } else {
        break;
      }
    }
    parentChain.reverse();
    body.innerHTML = renderDetail(item, type, parentChain);
  } else {
    body.innerHTML = renderDetail(item, type);
  }
  
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

function switchToModule(moduleName, addToHistory = true) {
  const file = state.files.find(f => f.name === moduleName);
  if (file) {
    // Switch to modules tab
    state.currentTab = 'modules';
    state.selectedItem = { name: file.name, type: 'module' };
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab[data-tab="modules"]').classList.add('active');
    document.getElementById('dataTypeTabs').style.display = 'none';
    updateUI();
    showModuleDetails(file, addToHistory);
  }
}

function showModuleDetails(file, addToHistory = true) {
  const prevTab = state.currentTab;
  const prevSubTab = state.currentSubTab;
  const prevSelected = state.selectedItem || { name: file.name, type: 'module' };
  if (addToHistory) {
    state.history.push({ tab: prevTab, subTab: prevSubTab, selected: prevSelected, detail: document.getElementById('detailHeader').style.display });
  }
  state.selectedItem = { name: file.name, type: 'module' };
  const header = document.getElementById('detailHeader');
  const welcome = document.getElementById('welcomeScreen');
  const title = document.getElementById('detailTitle');
  const meta = document.getElementById('detailMeta');
  const body = document.getElementById('detailBody');
  welcome.style.display = 'none';
  header.style.display = 'block';
  title.textContent = file.name;
  meta.textContent = '';
  
  const backBtn = document.getElementById('backBtn');
  backBtn.style.display = state.history.length > 0 ? 'inline-block' : 'none';
  
  body.innerHTML = renderModuleBody(file);
  saveToStorage();
}

function renderModuleBody(file) {
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
        d.rows.forEach(r => { html += '<tr><th style="white-space:nowrap;">' + r.key + '</th><td>' + r.value + '</td></tr>'; }); html += '</table></div>'; } else { html += '<div>' + name + '</div>'; } }); return html; })() : 'None'}</td></tr>
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
    <button class="btn btn-danger" style="margin-top:12px" onclick="removeFile(${state.files.indexOf(file)}); document.getElementById('detailHeader').style.display='none'; document.getElementById('detailBody').innerHTML='';">Remove Module</button>
  </div>`;
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateUI() {
  updateTabCounts();
  updateTabScrollButtons();
  const treeView = document.getElementById('treeView');
  const exportBtn = document.getElementById('exportBtn');
  const backBtn = document.getElementById('backBtn');
  const treeControls = document.getElementById('treeControls');
  const sidebar = document.querySelector('.sidebar');
  const hasData = state.files.length > 0;
  exportBtn.style.display = hasData ? 'inline-block' : 'none';
  backBtn.style.display = state.history.length > 0 ? 'inline-block' : 'none';
  
  // Hide tree/sidebar for Appspaces tab (uses main panel, not sidebar)
  if (state.currentTab === 'appspaces') {
    treeView.innerHTML = '';
    if (treeControls) treeControls.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    renderAppspacesPanel();
    return;
  } else {
    if (sidebar) sidebar.style.display = '';
  }
  
  if (!state.mergedFOM && state.currentTab !== 'modules') { treeView.innerHTML = '<div class="empty-state">Load FOM files to begin. Use the "Load FOM" button in the header.</div>'; return; }
  if (state.currentTab === 'modules') {
    const files = state.sortEnabled === 'asc' ? [...state.files].sort((a, b) => a.name.localeCompare(b.name)) : state.sortEnabled === 'desc' ? [...state.files].sort((a, b) => b.name.localeCompare(a.name)) : state.files;
    treeView.innerHTML = '<div class="tree-wrapper">' + (files.length > 0 ? files.map(f => `<div class="tree-item" data-name="${f.name}"><span class="icon">📄</span><span class="name" title="${f.name}">${f.name}</span></div>`).join('') : '<div class="empty-state">No FOM modules loaded. Use the "Load FOM" button in the header.</div>') + '</div>';
    if (state.selectedItem && state.selectedItem.type === 'module') {
      const selectedItem = treeView.querySelector(`.tree-item[data-name="${state.selectedItem.name}"]`);
      if (selectedItem) selectedItem.classList.add('selected');
    }
  } else if (state.currentTab === 'objects') {
    const classes = mergeClasses(state.files, 'object');
    const tree = buildClassTree(classes, state.sortEnabled);
    treeView.innerHTML = '<div class="tree-header"><button class="btn btn-small" onclick="document.querySelectorAll(\'.tree-children\').forEach(el=>el.classList.remove(\'collapsed\'));document.querySelectorAll(\'.tree-toggle[data-expanded]\').forEach(el=>{el.dataset.expanded=\'true\';el.textContent=\'▼\';});">⬇ Expand All</button><button class="btn btn-small" onclick="document.querySelectorAll(\'.tree-children\').forEach(el=>el.classList.add(\'collapsed\'));document.querySelectorAll(\'.tree-toggle[data-expanded]\').forEach(el=>{el.dataset.expanded=\'false\';el.textContent=\'▶\';});">⬆ Collapse All</button></div><div class="tree-wrapper">' + renderTree(tree, 'object') + '</div>';
  } else if (state.currentTab === 'interactions') {
    const classes = mergeClasses(state.files, 'interaction');
    const tree = buildClassTree(classes, state.sortEnabled);
    treeView.innerHTML = '<div class="tree-header"><button class="btn btn-small" onclick="document.querySelectorAll(\'.tree-children\').forEach(el=>el.classList.remove(\'collapsed\'));document.querySelectorAll(\'.tree-toggle[data-expanded]\').forEach(el=>{el.dataset.expanded=\'true\';el.textContent=\'▼\';});">⬇ Expand All</button><button class="btn btn-small" onclick="document.querySelectorAll(\'.tree-children\').forEach(el=>el.classList.add(\'collapsed\'));document.querySelectorAll(\'.tree-toggle[data-expanded]\').forEach(el=>{el.dataset.expanded=\'false\';el.textContent=\'▶\';});">⬆ Collapse All</button></div><div class="tree-wrapper">' + renderTree(tree, 'interaction') + '</div>';
  } else if (state.currentTab === 'dims') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderDimensionsList() + '</div>';
    if (!state.selectedItem && state.files?.some(f => f.dimensions?.length > 0)) {
      const firstItem = treeView.querySelector('.tree-item');
      if (firstItem) {
        firstItem.classList.add('selected');
        const name = firstItem.dataset.name;
        if (name) showDetail(name, 'dims');
      }
    }
  } else if (state.currentTab === 'trans') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderTransList() + '</div>';
    if (!state.selectedItem && state.mergedFOM?.transportations?.length > 0) {
      const firstItem = treeView.querySelector('.tree-item');
      if (firstItem) {
        firstItem.classList.add('selected');
        const name = firstItem.dataset.name;
        if (name) showDetail(name, 'trans');
      }
    }
  } else if (state.currentTab === 'notes') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderNotesList() + '</div>';
    if (!state.selectedItem && state.files?.some(f => f.notes?.length > 0)) {
      const firstItem = treeView.querySelector('.tree-item');
      if (firstItem) {
        firstItem.classList.add('selected');
        const name = firstItem.dataset.name;
        if (name) showDetail(name, 'notes', true);
      }
    }
  } else if (state.currentTab === 'switches') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderSwitchesList() + '</div>';
    if (!state.selectedItem && state.mergedFOM?.switches?.length > 0) {
      const firstItem = treeView.querySelector('.tree-item');
      if (firstItem) {
        firstItem.classList.add('selected');
        const name = firstItem.dataset.name;
        if (name) showDetail(name, 'switches');
      }
    }
  } else if (state.currentTab === 'tags') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderTagsList() + '</div>';
    if (!state.selectedItem && state.mergedFOM?.tags?.length > 0) {
      const firstItem = treeView.querySelector('.tree-item');
      if (firstItem) {
        firstItem.classList.add('selected');
        const name = firstItem.dataset.name;
        if (name) showDetail(name, 'tags');
      }
    }
  } else if (state.currentTab === 'time') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderTimeInfo() + '</div>';
    if (!state.selectedItem && state.mergedFOM?.time) {
      const firstItem = treeView.querySelector('.tree-item');
      if (firstItem) {
        firstItem.classList.add('selected');
        showDetail('time', 'time');
      }
    }
  } else {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderDataTypeList(state.currentSubTab) + '</div>';
  }
  treeView.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('tree-toggle')) {
        const isExpanded = e.target.dataset.expanded === 'true';
        e.target.dataset.expanded = (!isExpanded).toString();
        e.target.textContent = isExpanded ? '▶' : '▼';
        const children = e.target.parentElement.nextElementSibling;
        if (children) children.classList.toggle('collapsed');
        return;
      }
      treeView.querySelectorAll('.tree-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      const name = item.dataset.name;
      if (state.currentTab === 'modules') { const file = state.files.find(f => f.name === name); if (file) showModuleDetails(file, true); return; }
      const type = item.dataset.type || (state.currentTab === 'datatypes' ? state.currentSubTab : state.currentTab === 'objects' ? 'object' : state.currentTab === 'dims' ? 'dims' : state.currentTab === 'trans' ? 'trans' : state.currentTab === 'notes' ? 'notes' : state.currentTab === 'switches' ? 'switches' : state.currentTab === 'tags' ? 'tags' : state.currentTab === 'time' ? 'time' : 'interaction');
      showDetail(name, type, true);
    });
  });
}
// ============================================================================
// LIST RENDERING (sidebar tree views)
// ============================================================================

function renderTransList() {
  if (!state.mergedFOM || !state.mergedFOM.transportations || state.mergedFOM.transportations.length === 0) return '<div class="empty-state">No transportations. Load a FOM file containing HLAstandardMIM.xml or similar to see transport types (HLAreliable, HLAbestEffort).</div>';
  let html = '';
  const list = state.sortEnabled === 'asc' ? [...state.mergedFOM.transportations].sort((a, b) => a.name.localeCompare(b.name)) : state.sortEnabled === 'desc' ? [...state.mergedFOM.transportations].sort((a, b) => b.name.localeCompare(a.name)) : state.mergedFOM.transportations;
  list.forEach(t => {
    const name = t.name;
    const escapedName = name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    html += `<div class="tree-item" data-name="${escapedName}" data-type="trans"><span class="icon">🚚</span><span class="name">${name}</span></div>`;
  });
  return html;
}
function renderNotesList() {
  if (!state.files || state.files.length === 0) return '<div class="empty-state">No FOM files loaded. Use the "Load FOM" button in the header.</div>';
  let allNotes = [];
  state.files.forEach(f => {
    if (f.notes && f.notes.length > 0) {
      f.notes.forEach(n => {
        const name = typeof n === 'string' ? n : (n.name || 'Note');
        allNotes.push(name);
      });
    }
  });
  if (state.sortEnabled === 'asc') allNotes.sort((a, b) => a.localeCompare(b));
  else if (state.sortEnabled === 'desc') allNotes.sort((a, b) => b.localeCompare(a));
  let html = '';
  allNotes.forEach(name => {
    const displayName = name.length > 30 ? name.substring(0, 30) + '...' : name;
    const escapedName = name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    html += `<div class="tree-item" data-name="${escapedName}" data-type="notes"><span class="icon">📝</span><span class="name">${displayName}</span></div>`;
  });
  return html || '<div class="empty-state">No notes in loaded FOM files.</div>';
}
function renderDimensionsList() {
  if (!state.files || state.files.length === 0) return '<div class="empty-state">No FOM files loaded. Use the "Load FOM" button in the header.</div>';
  let allDims = [];
  state.files.forEach(f => {
    if (f.dimensions && f.dimensions.length > 0) {
      f.dimensions.forEach(d => { allDims.push(d); });
    }
  });
  if (state.sortEnabled === 'asc') allDims.sort((a, b) => a.name.localeCompare(b.name));
  else if (state.sortEnabled === 'desc') allDims.sort((a, b) => b.name.localeCompare(a.name));
  let html = '';
  allDims.forEach(d => {
    const escapedName = d.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    html += `<div class="tree-item" data-name="${escapedName}" data-type="dims"><span class="icon">📐</span><span class="name">${d.name}</span></div>`;
  });
  return html || '<div class="empty-state">No dimensions</div>';
}

function mergeSwitches(files) {
  const map = {};
  files.forEach(f => {
    if (!f.switches) return;
    f.switches.forEach(s => {
      if (!map[s.name]) { map[s.name] = { ...s, _sources: [f.name] }; }
      else { map[s.name]._sources.push(f.name); }
    });
  });
  return Object.values(map);
}

function mergeTags(files) {
  const map = {};
  files.forEach(f => {
    if (!f.tags) return;
    f.tags.forEach(t => {
      if (!map[t.name]) { map[t.name] = { ...t, _sources: [f.name] }; }
      else { map[t.name]._sources.push(f.name); }
    });
  });
  return Object.values(map);
}

function mergeTime(files) {
  const result = { timeStamp: null, lookahead: null, _sources: [] };
  files.forEach(f => {
    if (!f.time) return;
    result._sources.push(f.name);
    if (!result.timeStamp && f.time.timeStamp) result.timeStamp = f.time.timeStamp;
    if (!result.lookahead && f.time.lookahead) result.lookahead = f.time.lookahead;
  });
  return result;
}

function renderSwitchesList() {
  if (!state.mergedFOM || !state.mergedFOM.switches || state.mergedFOM.switches.length === 0) return '<div class="empty-state">No switches. Switches are typically defined in RPR-Base_v3.0.xml or similar FOM files.</div>';
  let allSwitches = [...state.mergedFOM.switches];
  if (state.sortEnabled === 'asc') allSwitches.sort((a, b) => a.name.localeCompare(b.name));
  else if (state.sortEnabled === 'desc') allSwitches.sort((a, b) => b.name.localeCompare(a.name));
  let html = '';
  allSwitches.forEach(s => {
    const escapedName = s.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    html += `<div class="tree-item" data-name="${escapedName}" data-type="switches"><span class="icon">🔘</span><span class="name">${s.name}</span></div>`;
  });
  return html;
}

function renderTagsList() {
  if (!state.mergedFOM || !state.mergedFOM.tags || state.mergedFOM.tags.length === 0) return '<div class="empty-state">No tags. Tags are typically defined in RPR-Base_v3.0.xml or similar FOM files.</div>';
  let allTags = [...state.mergedFOM.tags];
  if (state.sortEnabled === 'asc') allTags.sort((a, b) => a.name.localeCompare(b.name));
  else if (state.sortEnabled === 'desc') allTags.sort((a, b) => b.name.localeCompare(a.name));
  let html = '';
  allTags.forEach(t => {
    const escapedName = t.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    html += `<div class="tree-item" data-name="${escapedName}" data-type="tags"><span class="icon">🏷️</span><span class="name">${t.name}</span></div>`;
  });
  return html;
}

function renderTimeInfo() {
  if (!state.mergedFOM || !state.mergedFOM.time) return '<div class="empty-state">No time configuration. Time configuration is typically defined in RPR-Base_v3.0.xml or similar FOM files.</div>';
  return '<div class="tree-item" data-name="time" data-type="time"><span class="icon">⏱️</span><span class="name">Time Configuration</span></div>';
}

function updateTabCounts() {
  if (!state.mergedFOM) return;
  
  // Update tab counts
  const tabs = [
    { id: 'modules', getCount: () => state.files.length },
    { id: 'objects', getCount: () => state.mergedFOM.objectClasses?.length || 0 },
    { id: 'interactions', getCount: () => state.mergedFOM.interactionClasses?.length || 0 },
    { id: 'datatypes', getCount: () => {
      const dt = state.mergedFOM.dataTypes;
      return (dt.basic?.length || 0) + (dt.simple?.length || 0) + (dt.array?.length || 0) + (dt.fixed?.length || 0) + (dt.enum?.length || 0) + (dt.variant?.length || 0);
    }},
    { id: 'dims', getCount: () => state.files.reduce((sum, f) => sum + (f.dimensions?.length || 0), 0) },
    { id: 'trans', getCount: () => state.mergedFOM.transportations?.length || 0 },
    { id: 'switches', getCount: () => state.mergedFOM.switches?.length || 0 },
    { id: 'tags', getCount: () => state.mergedFOM.tags?.length || 0 },
    { id: 'time', getCount: () => state.mergedFOM.time ? 1 : 0 },
    { id: 'notes', getCount: () => state.files.reduce((sum, f) => sum + (f.notes?.length || 0), 0) }
  ];
  tabs.forEach(tab => {
    const tabEl = document.querySelector(`.tab[data-tab="${tab.id}"]`);
    if (tabEl) {
      const count = tab.getCount();
      const label = tabEl.textContent.split(' (')[0];
      tabEl.textContent = count > 0 ? `${label} (${count})` : label;
    }
  });
  const subtabs = [
    { id: 'basic', getCount: () => state.mergedFOM.dataTypes.basic?.length || 0 },
    { id: 'simple', getCount: () => state.mergedFOM.dataTypes.simple?.length || 0 },
    { id: 'array', getCount: () => state.mergedFOM.dataTypes.array?.length || 0 },
    { id: 'fixed', getCount: () => state.mergedFOM.dataTypes.fixed?.length || 0 },
    { id: 'enum', getCount: () => state.mergedFOM.dataTypes.enum?.length || 0 },
    { id: 'variant', getCount: () => state.mergedFOM.dataTypes.variant?.length || 0 }
  ];
  subtabs.forEach(tab => {
    const tabEl = document.querySelector(`.subtab[data-subtab="${tab.id}"]`);
    if (tabEl) {
      const count = tab.getCount();
      const label = tabEl.textContent.split(' (')[0];
      tabEl.textContent = count > 0 ? `${label} (${count})` : label;
    }
  });
  
  // Update welcome screen stats
  updateWelcomeStats();
}

function updateWelcomeStats() {
  const statsEl = document.getElementById('welcomeStats');
  if (!statsEl || !state.mergedFOM) return;
  
  const dt = state.mergedFOM.dataTypes;
  const totalBasic = dt.basic?.length || 0;
  const totalSimple = dt.simple?.length || 0;
  const totalArray = dt.array?.length || 0;
  const totalFixed = dt.fixed?.length || 0;
  const totalEnum = dt.enum?.length || 0;
  const totalVariant = dt.variant?.length || 0;
  const totalObjects = state.mergedFOM.objectClasses?.length || 0;
  const totalInteractions = state.mergedFOM.interactionClasses?.length || 0;
  const totalModules = state.files.length;
  
  statsEl.innerHTML = `
    <div class="stat-item"><span class="stat-value">${totalModules}</span><span class="stat-label">Modules</span></div>
    <div class="stat-item"><span class="stat-value">${totalObjects}</span><span class="stat-label">Objects</span></div>
    <div class="stat-item"><span class="stat-value">${totalInteractions}</span><span class="stat-label">Interactions</span></div>
    <div class="stat-item"><span class="stat-value">${totalBasic + totalSimple + totalArray + totalFixed + totalEnum + totalVariant}</span><span class="stat-label">Data Types</span></div>
  `;
  statsEl.style.display = 'flex';
}

async function loadFiles(files) {
  for (const file of files) {
    try { const text = await file.text(); const parser = new FOMParser(text); const fom = parser.parse(); state.files.push(fom); }
    catch (e) { console.error('Parse error:', e); state.errors.push(`Failed to parse ${file.name}: ${e.message}`); }
  }
  if (state.files.length > 0) { 
    const sorted = topologicalSort(state.files); 
    state.mergedFOM = { 
      objectClasses: mergeClasses(sorted, 'object'), 
      interactionClasses: mergeClasses(sorted, 'interaction'), 
      dataTypes: mergeDataTypes(sorted),
      transportations: mergeTransportations(sorted),
      switches: mergeSwitches(sorted),
      tags: mergeTags(sorted),
      time: mergeTime(sorted)
    }; 
    state.currentTab = 'modules';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab[data-tab="modules"]').classList.add('active');
    document.getElementById('dataTypeTabs').style.display = 'none';
    saveToStorage(); 
    updateUI();
    setTimeout(() => {
      const firstItem = document.querySelector('.tree-item');
      if (firstItem) {
        const fileName = firstItem.dataset.name;
        const file = state.files.find(f => f.name === fileName);
        if (file) showModuleDetails(file, false);
      }
    }, 50);
  } else {
    saveToStorage(); updateUI();
  }
}

// ============================================================================
// FILE MANAGEMENT
// ============================================================================

function removeFile(index) {
  state.files.splice(index, 1);
  if (state.files.length > 0) { 
    const sorted = topologicalSort(state.files); 
    state.mergedFOM = { objectClasses: mergeClasses(sorted, 'object'), interactionClasses: mergeClasses(sorted, 'interaction'), dataTypes: mergeDataTypes(sorted), transportations: mergeTransportations(sorted), switches: mergeSwitches(sorted), tags: mergeTags(sorted), time: mergeTime(sorted) }; 
  }
  else { state.mergedFOM = null; }
  saveToStorage(); updateUI();
}

document.getElementById('fileInput').addEventListener('change', e => { loadFiles(Array.from(e.target.files)); });

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

document.getElementById('exportBtn').addEventListener('click', () => { window.print(); });

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const prevDetailShowing = document.getElementById('detailHeader').style.display !== 'none';
    const prevTab = state.currentTab;
    const prevSubTab = state.currentSubTab;
    const prevSelected = state.selectedItem;

    if (state.currentTab !== tab.dataset.tab) { 
      if (prevDetailShowing) {
        debugBack('tab click: prevTab=%s, prevSelected=%s', prevTab, prevSelected ? prevSelected.name + '/' + prevSelected.type : 'null');
        const historySubTab = prevTab === 'appspaces' ? state.appspaceSubTab : prevSubTab;
        state.history.push({ tab: prevTab, subTab: historySubTab, selected: prevSelected, detail: 'block' });
      }
    }
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); state.currentTab = tab.dataset.tab; state.selectedItem = null;
    const dtTabs = document.getElementById('dataTypeTabs'); dtTabs.style.display = state.currentTab === 'datatypes' ? 'flex' : 'none';
    const appspaceTabs = document.getElementById('appspaceTabs'); appspaceTabs.style.display = state.currentTab === 'appspaces' ? 'flex' : 'none';
    document.getElementById('detailHeader').style.display = 'none'; document.getElementById('detailBody').innerHTML = '';
    saveToStorage(); updateUI();

    // Handle Appspaces tab
    if (state.currentTab === 'appspaces') {
      // Ensure a subtab is selected
      if (!state.appspaceSubTab) state.appspaceSubTab = 'objects';
      document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
      const activeSubtab = document.querySelector(`#appspaceTabs .subtab[data-subtab="${state.appspaceSubTab}"]`);
      if (activeSubtab) activeSubtab.classList.add('active');
      updateAppspaceTabCount();
      renderAppspacesPanel();
      return;
    }

    // Auto-select first item WITHOUT pushing to history
    setTimeout(() => {
      const firstItem = document.querySelector('.tree-item');
      if (firstItem) {
        firstItem.classList.add('selected');
        const name = firstItem.dataset.name;
        // Determine type based on current tab
        let type = firstItem.dataset.type;
        if (!type) {
          if (state.currentTab === 'objects') type = 'object';
          else if (state.currentTab === 'interactions') type = 'interaction';
          else if (state.currentTab === 'modules') type = 'module';
          else if (state.currentTab === 'datatypes') type = state.currentSubTab;
          else if (state.currentTab === 'dims') type = 'dims';
          else if (state.currentTab === 'trans') type = 'trans';
          else if (state.currentTab === 'notes') type = 'notes';
          else if (state.currentTab === 'switches') type = 'switches';
          else if (state.currentTab === 'tags') type = 'tags';
          else if (state.currentTab === 'time') type = 'time';
        }
        if (type && name) {
          state.selectedItem = { name, type: type === 'module' ? 'module' : type };
          let itemData, source = '';
          if (state.currentTab === 'modules') {
            const file = state.files.find(f => f.name === name);
            if (file) showModuleDetails(file, false);
            return;
          } else if (type === 'object') { itemData = state.mergedFOM.objectClasses.find(c => c.name === name); source = itemData?._source || ''; }
          else if (type === 'interaction') { itemData = state.mergedFOM.interactionClasses.find(c => c.name === name); source = itemData?._source || ''; }
          else if (type === 'trans') { itemData = state.mergedFOM.transportations?.find(t => t.name.trim() === name.trim()); source = name; }
          else if (type === 'dims') { for (const f of state.files) { if (f.dimensions) { itemData = f.dimensions.find(d => d.name === name); if (itemData) { source = f.name; break; } } } }
          else if (type === 'notes') { for (const f of state.files) { if (f.notes) { itemData = f.notes.find(n => (typeof n === 'string' ? n : n.name) === name); if (itemData) { source = f.name; break; } } } }
          else if (type === 'switches') { itemData = state.mergedFOM.switches?.find(s => s.name.trim() === name.trim()); source = name; }
          else if (type === 'tags') { itemData = state.mergedFOM.tags?.find(t => t.name.trim() === name.trim()); source = name; }
          else if (type === 'time') { itemData = state.mergedFOM.time; source = 'Time Configuration'; }
          else { itemData = state.mergedFOM.dataTypes[type]?.find(d => d.name === name); source = itemData?._source || ''; }
          const header = document.getElementById('detailHeader');
          const welcome = document.getElementById('welcomeScreen');
          const title = document.getElementById('detailTitle');
          const meta = document.getElementById('detailMeta');
          const body = document.getElementById('detailBody');
          welcome.style.display = 'none';
          header.style.display = 'block';
          title.textContent = name;
          meta.textContent = source;
          body.innerHTML = renderDetail(itemData, type);
          saveToStorage();
        }
      }
    }, 50);
  });
});

document.querySelectorAll('.subtab').forEach(tab => {
  tab.addEventListener('click', () => {
    const prevDetailShowing = document.getElementById('detailHeader').style.display !== 'none';
    const prevTab = state.currentTab;
    const prevSubTab = state.currentSubTab;
    const prevSelected = state.selectedItem;
    
    if (state.currentSubTab !== tab.dataset.subtab) { 
      if (prevDetailShowing) {
        state.history.push({ tab: prevTab, subTab: prevSubTab, selected: prevSelected, detail: 'block' });
      }
    }
    document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); state.currentSubTab = tab.dataset.subtab;
    state.selectedItem = null;
    document.getElementById('detailHeader').style.display = 'none';
    document.getElementById('detailBody').innerHTML = '';
    saveToStorage(); updateUI();
    
    // Auto-select first item WITHOUT pushing to history
    setTimeout(() => {
      const firstItem = document.querySelector('.tree-item');
      if (firstItem) {
        firstItem.classList.add('selected');
        const name = firstItem.dataset.name;
        const type = firstItem.dataset.type || state.currentSubTab;
        if (type && name) {
          state.selectedItem = { name, type };
          let itemData, source = '';
          itemData = state.mergedFOM.dataTypes[type]?.find(d => d.name === name);
          source = itemData?._source || '';
          const header = document.getElementById('detailHeader');
          const welcome = document.getElementById('welcomeScreen');
          const title = document.getElementById('detailTitle');
          const meta = document.getElementById('detailMeta');
          const body = document.getElementById('detailBody');
          welcome.style.display = 'none';
          header.style.display = 'block';
          title.textContent = name;
          meta.textContent = source;
          body.innerHTML = renderDetail(itemData, type);
          saveToStorage();
        }
      }
    }, 50);
  });
});

// Appspace subtab click handler
document.querySelectorAll('#appspaceTabs .subtab').forEach(tab => {
  tab.addEventListener('click', () => {
    const prevDetailShowing = document.getElementById('detailHeader').style.display !== 'none';
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
    document.getElementById('detailHeader').style.display = 'none';
    document.getElementById('detailBody').innerHTML = '';
    saveAppspaceToStorage();
    updateUI();
    renderAppspacesPanel();
  });
});

// Render Appspaces panel
function renderAppspacesPanel() {
  const body = document.getElementById('detailBody');
  const header = document.getElementById('detailHeader');
  const title = document.getElementById('detailTitle');
  const meta = document.getElementById('detailMeta');
  const welcome = document.getElementById('welcomeScreen');

  if (!state.appspace) {
    body.innerHTML = '<div class="empty-state">No appspace file loaded. Use the "Load Appspace" button to load an appspace file.</div>';
    return;
  }

  welcome.style.display = 'none';
  header.style.display = 'block';
  title.textContent = 'Appspaces';
  meta.textContent = `Loaded from ${state.appspace.fileName || 'file'}`;

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
    html += '<tr><th>Class</th><th>App(s)</th></tr>';
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
          html += `<span class="tree-part leaf">${part}</span>`;
        } else if (isLeaf) {
          html += `<span class="tree-part leaf appspace-link" onclick="showDetail('${fullClassName}', '${clickType}', true)">${part}</span>`;
        } else {
          html += `<span class="tree-part parent">${part}</span>`;
        }
      });
      html += '</td><td><ul class="apps-list">';
      entry.apps.forEach(app => { html += `<li>${app}</li>`; });
      html += '</ul></td></tr>';
    });
    html += '</table>';
  }

  body.innerHTML = html;
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


document.getElementById('globalSearch').addEventListener('input', e => {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    updateUI();
    return;
  }
  const results = [];
  if (state.mergedFOM) {
    state.mergedFOM.objectClasses?.forEach(c => { if (c.name.toLowerCase().includes(query)) results.push({ name: c.name, type: 'object' }); });
    state.mergedFOM.interactionClasses?.forEach(c => { if (c.name.toLowerCase().includes(query)) results.push({ name: c.name, type: 'interaction' }); });
    state.mergedFOM.dataTypes.basic?.forEach(d => { if (d.name.toLowerCase().includes(query)) results.push({ name: d.name, type: 'basic' }); });
    state.mergedFOM.dataTypes.simple?.forEach(d => { if (d.name.toLowerCase().includes(query)) results.push({ name: d.name, type: 'simple' }); });
    state.mergedFOM.dataTypes.array?.forEach(d => { if (d.name.toLowerCase().includes(query)) results.push({ name: d.name, type: 'array' }); });
    state.mergedFOM.dataTypes.fixed?.forEach(d => { if (d.name.toLowerCase().includes(query)) results.push({ name: d.name, type: 'fixed' }); });
    state.mergedFOM.dataTypes.enum?.forEach(d => { if (d.name.toLowerCase().includes(query)) results.push({ name: d.name, type: 'enum' }); });
    state.mergedFOM.dataTypes.variant?.forEach(d => { if (d.name.toLowerCase().includes(query)) results.push({ name: d.name, type: 'variant' }); });
    state.mergedFOM.transportations?.forEach(t => { if (t.name.toLowerCase().includes(query)) results.push({ name: t.name, type: 'trans' }); });
    state.mergedFOM.switches?.forEach(s => { if (s.name.toLowerCase().includes(query)) results.push({ name: s.name, type: 'switches' }); });
    state.mergedFOM.tags?.forEach(t => { if (t.name.toLowerCase().includes(query)) results.push({ name: t.name, type: 'tags' }); });
  }
  state.files.forEach(f => {
    f.dimensions?.forEach(d => { if (d.name.toLowerCase().includes(query)) results.push({ name: d.name, type: 'dims' }); });
    f.notes?.forEach(n => { const nname = typeof n === 'string' ? n : n.name || ''; if (nname.toLowerCase().includes(query)) results.push({ name: nname, type: 'notes' }); });
  });
  if (state.mergedFOM?.time && 'time'.includes(query)) results.push({ name: 'Time Configuration', type: 'time' });
  const treeView = document.getElementById('treeView');
  const typeIcons = { object: '📦', interaction: '💬', basic: '🔤', simple: '📝', array: '📋', fixed: '📑', enum: '🔢', variant: '🔀', trans: '🚚', switches: '🔘', tags: '🏷️', dims: '📐', notes: '📝', time: '⏱️' };
  treeView.innerHTML = '<div class="tree-wrapper">' + (results.length > 0 ? results.map(r => `<div class="tree-item" data-name="${r.name}" data-type="${r.type}"><span class="icon">${typeIcons[r.type] || '📄'}</span><span class="name">${r.name}</span></div>`).join('') : '<div class="empty-state">No results found. Try a different search term.</div>') + '</div>';
  treeView.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('click', () => {
      treeView.querySelectorAll('.tree-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      showDetail(item.dataset.name, item.dataset.type);
    });
  });
});

async function init() {
  try {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('detailHeader').style.display = 'none';
    updateUI();
    await loadFromStorage();
  } catch(e) {
    console.error('ERROR in init():', e);
    alert('Error in init: ' + e.message);
  }
}

// ============================================================================
// DATA TYPE NAVIGATION
// ============================================================================

function showDataType(name, preferredType) {
  // Save current state to history BEFORE switching
  if (state.selectedItem) {
    const historyEntry = { tab: state.currentTab, subTab: state.currentSubTab, selected: { ...state.selectedItem }, detail: document.getElementById('detailHeader').style.display };
    state.history.push(historyEntry);
  }
  
  // Now load the new data type
  state.currentTab = 'datatypes'; state.currentSubTab = preferredType; state.selectedItem = { name, type: preferredType };
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.tab[data-tab="datatypes"]').classList.add('active');
  const dtTabs = document.getElementById('dataTypeTabs'); dtTabs.style.display = 'flex';
  document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.subtab[data-subtab="${preferredType}"]`).classList.add('active');
  saveToStorage(); updateUI();
  setTimeout(() => {
    let foundType = preferredType; let item = document.querySelector(`.tree-item[data-name="${name}"]`);
    if (!item) { const types = ['basic', 'simple', 'array', 'fixed', 'enum', 'variant']; for (const t of types) { state.currentSubTab = t; document.querySelectorAll('.subtab').forEach(st => st.classList.remove('active')); document.querySelector(`.subtab[data-subtab="${t}"]`).classList.add('active'); updateUI(); item = document.querySelector(`.tree-item[data-name="${name}"]`); if (item) { foundType = t; break; } } }
    state.currentSubTab = foundType;
    document.querySelectorAll('.subtab').forEach(st => st.classList.remove('active'));
    document.querySelector(`.subtab[data-subtab="${foundType}"]`).classList.add('active');
    const header = document.getElementById('detailHeader');
    const welcome = document.getElementById('welcomeScreen');
    const title = document.getElementById('detailTitle');
    const meta = document.getElementById('detailMeta');
    const body = document.getElementById('detailBody');
    welcome.style.display = 'none';
    header.style.display = 'block';
    const itemData = state.mergedFOM.dataTypes[foundType]?.find(d => d.name === name);
    title.textContent = name;
    meta.textContent = itemData?._source || '';
    body.innerHTML = renderDetail(itemData, foundType);
    
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
    if (!prev || !prev.selected) { document.getElementById('backBtn').style.display = 'none'; saveToStorage(); return; }
    
    if (currentTabNow === 'datatypes') {
      restoreState = {
        tab: prev.tab || 'datatypes',
        subTab: prev.selected.type,
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
    const validTabs = ['modules', 'objects', 'interactions', 'dims', 'trans', 'notes', 'switches', 'tags', 'time', 'datatypes', 'appspaces'];
    let sameTabEntry = null;
    let diffTabEntry = null;
    
    debugBack('goBack: searching for sameTabEntry, currentTabNow=%s', currentTabNow);
    
    // First pass: look for same-tab entry
    for (let i = state.history.length - 1; i >= 0; i--) {
      const entry = state.history[i];
      if (entry && entry.selected && entry.tab && validTabs.includes(entry.tab) && entry.tab === currentTabNow) {
        sameTabEntry = entry;
        break;
      }
    }
    
    // Second pass: look for different-tab entry (only if no same-tab entry)
    if (!sameTabEntry) {
      for (let i = state.history.length - 1; i >= 0; i--) {
        const entry = state.history[i];
        if (entry && entry.selected && entry.tab && validTabs.includes(entry.tab) && entry.tab !== currentTabNow) {
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
  
  const prevTab = restoreState.tab;
  
  // CRITICAL: Update state.currentTab to the restoreState tab
  state.currentTab = restoreState.tab;
  
  // Update tab UI
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${restoreState.tab}"]`)?.classList.add('active');
  
  // For datatype tab, also update the sub-tab UI
  if (restoreState.tab === 'datatypes') {
    const dtTabs = document.getElementById('dataTypeTabs');
    dtTabs.style.display = 'flex';
    state.currentSubTab = restoreState.subTab;
    document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.subtab[data-subtab="${restoreState.subTab}"]`)?.classList.add('active');
  } else {
    document.getElementById('dataTypeTabs').style.display = 'none';
  }
  
  // For appspaces tab, update the sub-tab UI
  if (restoreState.tab === 'appspaces') {
    const appspaceTabs = document.getElementById('appspaceTabs');
    appspaceTabs.style.display = 'flex';
    state.appspaceSubTab = restoreState.subTab || 'objects';
    document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
    document.querySelector(`#appspaceTabs .subtab[data-subtab="${restoreState.subTab}"]`)?.classList.add('active');
    updateAppspaceTabCount();
  } else {
    document.getElementById('appspaceTabs').style.display = 'none';
  }
  
  debugBack('goBack: restoreState: tab=%s, subTab=%s, selected=%o', restoreState.tab, restoreState.subTab, restoreState.selected);
  
  // Rebuild tree for restoreState.tab
  const treeView = document.getElementById('treeView');
  if (restoreState.tab === 'modules') {
    const files = state.sortEnabled === 'asc' ? [...state.files].sort((a, b) => a.name.localeCompare(b.name)) : state.sortEnabled === 'desc' ? [...state.files].sort((a, b) => b.name.localeCompare(a.name)) : state.files;
    treeView.innerHTML = '<div class="tree-wrapper">' + (files.length > 0 ? files.map(f => `<div class="tree-item" data-name="${f.name.replace(/"/g, '&quot;')}"><span class="icon">📄</span><span class="name" title="${f.name}">${f.name}</span></div>`).join('') : '<div class="empty-state">No FOM modules loaded.</div>') + '</div>';
  } else if (restoreState.tab === 'objects') {
    const classes = mergeClasses(state.files, 'object');
    const tree = buildClassTree(classes, state.sortEnabled);
    treeView.innerHTML = '<div class="tree-header"><button class="btn btn-small" onclick="document.querySelectorAll(\'.tree-children\').forEach(el=>el.classList.remove(\'collapsed\'));document.querySelectorAll(\'.tree-toggle[data-expanded]\').forEach(el=>{el.dataset.expanded=\'true\';el.textContent=\'▼\';});">⬇ Expand All</button><button class="btn btn-small" onclick="document.querySelectorAll(\'.tree-children\').forEach(el=>el.classList.add(\'collapsed\'));document.querySelectorAll(\'.tree-toggle[data-expanded]\').forEach(el=>{el.dataset.expanded=\'false\';el.textContent=\'▶\';});">⬆ Collapse All</button></div><div class="tree-wrapper">' + renderTree(tree, 'object') + '</div>';
  } else if (restoreState.tab === 'interactions') {
    const classes = mergeClasses(state.files, 'interaction');
    const tree = buildClassTree(classes, state.sortEnabled);
    treeView.innerHTML = '<div class="tree-header"><button class="btn btn-small" onclick="document.querySelectorAll(\'.tree-children\').forEach(el=>el.classList.remove(\'collapsed\'));document.querySelectorAll(\'.tree-toggle[data-expanded]\').forEach(el=>{el.dataset.expanded=\'true\';el.textContent=\'▼\';});">⬇ Expand All</button><button class="btn btn-small" onclick="document.querySelectorAll(\'.tree-children\').forEach(el=>el.classList.add(\'collapsed\'));document.querySelectorAll(\'.tree-toggle[data-expanded]\').forEach(el=>{el.dataset.expanded=\'false\';el.textContent=\'▶\';});">⬆ Collapse All</button></div><div class="tree-wrapper">' + renderTree(tree, 'interaction') + '</div>';
  } else if (restoreState.tab === 'notes') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderNotesList() + '</div>';
  } else if (restoreState.tab === 'dims') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderDimensionsList() + '</div>';
  } else if (restoreState.tab === 'trans') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderTransList() + '</div>';
  } else if (restoreState.tab === 'switches') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderSwitchesList() + '</div>';
  } else if (restoreState.tab === 'tags') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderTagsList() + '</div>';
  } else if (restoreState.tab === 'time') {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderTimeInfo() + '</div>';
  } else if (restoreState.tab === 'appspaces') {
    // Show appspaces panel
    const appspaceTabs = document.getElementById('appspaceTabs');
    appspaceTabs.style.display = 'flex';
    state.appspaceSubTab = restoreState.subTab || 'objects';
    document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
    document.querySelector(`#appspaceTabs .subtab[data-subtab="${state.appspaceSubTab}"]`)?.classList.add('active');
    updateAppspaceTabCount();
    renderAppspacesPanel();
    document.getElementById('detailHeader').style.display = 'block';
    document.getElementById('detailTitle').textContent = 'Appspaces';
    document.getElementById('detailMeta').textContent = state.appspace?.fileName || '';
    // Don't show tree for appspaces
    treeView.innerHTML = '';
    return;
  } else {
    treeView.innerHTML = '<div class="tree-wrapper">' + renderDataTypeList(restoreState.subTab) + '</div>';
  }
  
  // Add click handlers
  treeView.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('click', () => {
      treeView.querySelectorAll('.tree-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      const name = item.dataset.name;
      const type = item.dataset.type || (state.currentTab === 'datatypes' ? state.currentSubTab : state.currentTab === 'objects' ? 'object' : state.currentTab === 'interactions' ? 'interaction' : state.currentTab);
      showDetail(name, type, true);
    });
  });
  
  // Select item in tree
  const escapedName = restoreState.selected.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const selectedItem = treeView.querySelector(`.tree-item[data-name="${escapedName}"]`);
  
  if (selectedItem) {
    selectedItem.classList.add('selected');
  }
  
  // Show detail
state.selectedItem = restoreState.selected;
  
  document.getElementById('detailHeader').style.display = 'block';
  
  let itemData = null;
  let source = '';
  
  debugBack('goBack: itemData lookup - restoreState.selected.type=%s', restoreState.selected.type);
  
  if (restoreState.tab === 'modules') {
    const file = state.files.find(f => f.name === restoreState.selected.name);
    itemData = file;
    source = '';
  } else if (restoreState.selected.type === 'object') {
    itemData = state.mergedFOM.objectClasses?.find(c => c.name === restoreState.selected.name);
    source = itemData?._source || '';
  } else if (restoreState.selected.type === 'interaction') {
    itemData = state.mergedFOM.interactionClasses?.find(c => c.name === restoreState.selected.name);
    source = itemData?._source || '';
  } else if (restoreState.selected.type === 'notes') {
    for (const f of state.files) {
      if (f.notes) {
        itemData = f.notes.find(n => (typeof n === 'string' ? n : n.name) === restoreState.selected.name);
        if (itemData) { source = f.name; break; }
      }
    }
  } else if (restoreState.selected.type === 'dims') {
    for (const f of state.files) {
      if (f.dimensions) {
        itemData = f.dimensions.find(d => d.name === restoreState.selected.name);
        if (itemData) { source = f.name; break; }
      }
    }
  } else if (restoreState.selected.type === 'trans') {
    itemData = state.mergedFOM?.transportations?.find(t => t.name.trim() === restoreState.selected.name.trim());
    source = restoreState.selected.name;
  } else if (restoreState.selected.type === 'switches') {
    itemData = state.mergedFOM?.switches?.find(s => s.name.trim() === restoreState.selected.name.trim());
    source = restoreState.selected.name;
  } else if (restoreState.selected.type === 'tags') {
    itemData = state.mergedFOM?.tags?.find(t => t.name.trim() === restoreState.selected.name.trim());
    source = restoreState.selected.name;
  } else if (restoreState.selected.type === 'time') {
    itemData = state.mergedFOM?.time;
    source = 'Time Configuration';
  } else if (['basic','simple','array','fixed','enum','variant'].includes(restoreState.selected.type)) {
    itemData = state.mergedFOM?.dataTypes?.[restoreState.selected.type]?.find(d => d.name === restoreState.selected.name);
    source = itemData?._source || '';
  }
  
  document.getElementById('detailTitle').textContent = restoreState.selected.name;
  document.getElementById('detailMeta').textContent = source;
  
  // Handle module rendering differently - use showModuleDetails
  debugBack('goBack: modules - itemData=%o, name=%s', itemData, restoreState.selected.name);
  if (restoreState.tab === 'modules') {
    if (itemData) {
      showModuleDetails(itemData, false);
    } else {
      document.getElementById('detailBody').innerHTML = 'Item not found';
    }
  } else {
    document.getElementById('detailBody').innerHTML = itemData ? renderDetail(itemData, restoreState.selected.type) : 'Item not found';
  }
  
  // Update back button visibility after popping history
  document.getElementById('backBtn').style.display = state.history.length > 0 ? 'inline-block' : 'none';
  
  saveToStorage();
}

document.getElementById('backBtn').addEventListener('click', () => {
  goBack();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Clear all loaded FOM files?')) {
    state.files = [];
    state.mergedFOM = null;
    state.selectedItem = null;
    state.history = [];
    state.currentTab = 'modules';
    state.currentSubTab = 'basic';
    clearStorage();
    updateUI();
    document.getElementById('detailHeader').style.display = 'none';
    document.getElementById('detailBody').innerHTML = '';
    document.getElementById('welcomeScreen').style.display = 'flex';
  }
});

// ============================================================================
// TAB SCROLLING
// ============================================================================

function scrollTabs(amount) {
  const container = document.getElementById('tabScrollContainer');
  if (container) container.scrollLeft += amount;
}

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
  let lineCount = 0;
  let parsedCount = 0;
  
  lines.forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    lineCount++;
    
    const parts = line.split('|');
    if (parts.length !== 2) return;
    
    const className = parts[0].trim();
    const apps = parts[1].split(',').map(a => a.trim()).filter(a => a);
    
    if (className && apps.length > 0) {
      parsedCount++;
      entries.push({ className, apps });
    }
  });
  
  return entries;
}

// Find matching appspace entries for a class
function findAppspaceForClass(className, type) {
  if (!state.appspace) return null;
  // Get the appropriate entries based on type
  const entries = type === 'object' ? state.appspace.entries : state.appspace.interactions;
  if (!entries) return null;
  
  // Find the most specific match (longest right-side match)
  let bestMatch = null;
  let bestLength = 0;
  
  entries.forEach(entry => {
    const entryParts = entry.className.split('.');
    const classParts = className.split('.');
    
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
        bestMatch = entry;
        bestLength = entryParts.length;
      }
    }
  });
  
  return bestMatch ? bestMatch.apps : null;
}

// Load appspace button click handler
function setupAppspaceButtons() {
  const loadBtn = document.getElementById('loadAppspaceBtn');
  const clearBtn = document.getElementById('clearAppspaceBtn');
  const exportSep = document.getElementById('exportAppspaceSeparator');
  const appspaceSep = document.getElementById('appspaceSeparator');
  
  // Set initial visibility - Load button always visible, Clear hidden until appspace loaded
  if (loadBtn) loadBtn.style.display = 'inline-block';
  if (clearBtn) clearBtn.style.display = 'none';
  if (exportSep) exportSep.style.display = 'none';
  if (appspaceSep) appspaceSep.style.display = 'none';
  
  // Add info button next to Theme toggle (before About button)
  if (!document.getElementById('appspaceInfoBtn')) {
    const themeBtn = document.getElementById('themeToggle');
    const aboutBtn = document.getElementById('aboutBtn');
    if (themeBtn && aboutBtn) {
      const infoBtn = document.createElement('button');
      infoBtn.id = 'appspaceInfoBtn';
      infoBtn.className = 'theme-toggle';
      infoBtn.textContent = 'ℹ️';
      infoBtn.title = 'Appspace file format help';
      infoBtn.style.cssText = 'font-size: 16px; padding: 8px 10px;';
      themeBtn.parentNode.insertBefore(infoBtn, aboutBtn);
      infoBtn.addEventListener('click', showAppspaceFormatModal);
    }
  }
  
  // Add right separator after Load Appspace button (before Clear Appspace)
  if (!document.getElementById('loadAppspaceSep')) {
    const loadBtn = document.getElementById('loadAppspaceBtn');
    const clearBtn = document.getElementById('clearAppspaceBtn');
    if (loadBtn && clearBtn) {
      const sep = document.createElement('div');
      sep.id = 'loadAppspaceSep';
      sep.className = 'header-separator';
      sep.style.display = 'none'; // Hidden until appspace loaded
      loadBtn.parentNode.insertBefore(sep, clearBtn);
    }
  }

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
          unknown: classified.unknown
        };
        state.appspaceSubTab = 'objects';
        
        // Update UI
        loadBtn.textContent = 'Change Appspace';
        loadBtn.style.display = 'inline-block';
        clearBtn.style.display = 'inline-block';
        if (exportSep) exportSep.style.display = 'block';
        if (appspaceSep) appspaceSep.style.display = 'block';
        const loadSep = document.getElementById('loadAppspaceSep');
        if (loadSep) loadSep.style.display = 'block';
        
        // Show Appspaces tab
        const appspaceTab = document.querySelector('.tab[data-tab="appspaces"]');
        if (appspaceTab) appspaceTab.style.display = 'block';
        
        // Update tab count
        updateAppspaceTabCount();
        
        saveAppspaceToStorage();
        
        // Switch to Appspaces tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        if (appspaceTab) appspaceTab.classList.add('active');
        state.currentTab = 'appspaces';
        state.selectedItem = null;
        
        updateUI();
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
      if (exportSep) exportSep.style.display = 'none';
      if (appspaceSep) appspaceSep.style.display = 'none';
      const loadSep = document.getElementById('loadAppspaceSep');
      if (loadSep) loadSep.style.display = 'none';
      
      // Hide Appspaces tab
      const appspaceTab = document.querySelector('.tab[data-tab="appspaces"]');
      if (appspaceTab) appspaceTab.style.display = 'none';
      
      // If currently on appspaces tab, switch to modules
      if (state.currentTab === 'appspaces') {
        document.querySelector('.tab[data-tab="modules"]').click();
      }
      
      clearAppspaceFromStorage();
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
  const tab = document.querySelector('.tab[data-tab="appspaces"]');
  if (!tab || !state.appspace) return;
  const total = (state.appspace.entries?.length || 0) + 
                (state.appspace.interactions?.length || 0) + 
                (state.appspace.unknown?.length || 0);
  tab.textContent = `Appspaces (${total})`;
  
  // Update subtab counts
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
    if (!db) await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({ name: '__appspace__', data: state.appspace, subTab: state.appspaceSubTab });
  } catch (e) { console.warn('Failed to save appspace to IndexedDB:', e); }
}

async function loadAppspaceFromStorage() {
  try {
    if (!db) await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('__appspace__');
    const result = await new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    if (result && result.data) {
      state.appspace = result.data;
      state.appspaceSubTab = result.subTab || 'objects';
      
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
        
        // Show Appspaces tab
        const appspaceTab = document.querySelector('.tab[data-tab="appspaces"]');
        if (appspaceTab) appspaceTab.style.display = 'block';
        
        updateAppspaceTabCount();
      }, 0);
    }
  } catch (e) { console.warn('Failed to load appspace from IndexedDB:', e); }
}

async function clearAppspaceFromStorage() {
  try {
    if (!db) await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete('__appspace__');
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
try {
  function doSetup() {
    setupAppspaceButtons();
    loadAppspaceFromStorage();
  }
  
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
// THEME TOGGLE
// ============================================================================

function initTheme() {
  const savedTheme = localStorage.getItem('fomViewerTheme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('fomViewerTheme', next);
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.textContent = next === 'dark' ? '🌙' : '☀️';
  }
}

// Theme toggle button handler
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

// About button handler
document.getElementById('aboutBtn')?.addEventListener('click', () => {
  const toast = document.getElementById('toast');
  toast.innerHTML = `
    <h3>About FOM Viewer</h3>
    <p>Single-page HTML viewer for IEEE 1516 FOM files. Load multiple FOM, MIM, and FED files to explore HLA data models.</p>
    <div class="version">Version 1.0.0 | <a href="https://github.com/dalemarchand/fom-viewer" target="_blank" style="color:var(--accent)">GitHub</a></div>
  `;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.classList.remove('show', 'fade-out');
    }, 300);
  }, 4000);
});

initTheme();

// ============================================================================
// END OF FILE
// ============================================================================

