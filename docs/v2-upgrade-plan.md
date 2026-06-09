# FOM Viewer v2.0 — Upgrade Plan

**Architecture Decision:** Svelte 5 (compiles to vanilla JS, single-file output, 3KB runtime, works on `file://`)

## Locked Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Architecture** | Svelte 5 | Compiles to vanilla JS, single-file output, works on `file://` |
| **Typing** | Hybrid: `types.d.ts` + JSDoc `// @ts-check` | Type safety without two learning curves |
| **Virtual scroller** | `svelte-window` | Minimal, well-tested with Svelte |
| **Web Worker bridge** | Comlink | RPC-style, minimal boilerplate |
| **Visualization** | Custom SVG | Tree diagrams are simple positioned elements |
| **Fuzzy search** | Fuse.js | Configurable, supports highlighting |
| **CSS approach** | Svelte scoped CSS | Scoped by default, keep styles.css for globals |
| **Unit test framework** | Vitest | Vite-native, Svelte testing library support |
| **Formatter** | Add Prettier | Zero-config, auto-format on save |
| **Branch strategy** | `v2` branch | Clean separation, merge when complete |

---

## Enhancement Inventory (All Categories)

### 1. Architecture — Monolith → Component System
| # | Enhancement | Current | Target | Impact |
|---|-------------|---------|--------|--------|
| 1.1 | Single-file JS → Svelte components | 4790-line main.js | ~15-20 components, ~900 lines total | Massive — eliminates all innerHTML, inline onclick, global scope pollution |
| 1.2 | State management | Manual `state` object + `saveToStorage()` | Svelte `$state` + derived + persisted store | Eliminates manual updateUI() calls — reactivity |
| 1.3 | Build pipeline | Custom 130-line build.js | Vite + svelte plugin + inline plugin | Better DX, HMR, faster rebuilds |
| 1.4 | Dead code removal | `state.uiState`, `state.conflicts`, `state.errors`, 86x `<!-- FOM Viewer v1.0.0 -->` | Clean slate | Reduces confusion |
| 1.5 | Event handling | 5 patterns (direct, delegated, inline onclick, per-render re-bind, global) | Svelte event directives (`on:click`) | Consistent, no leaky listeners |
| 1.6 | XSS sanitization | `innerHTML` with FOM data → broken escape | DOMPurify or safe Svelte template interpolation | Security fix |

### 2. Parser (FOMParser)
| # | Enhancement | Current | Target | Impact |
|---|-------------|---------|--------|--------|
| 2.1 | Parser in Web Worker | Blocks main thread for large FOMs | Offload via Comlink/Worker | UI stays responsive during load |
| 2.2 | Parse progress indication | None | Progress bar for large files | UX improvement |
| 2.3 | Error recovery | First parse error kills file | Partial parse + issues for malformed sections | More forgiving |
| 2.4 | IEEE 1516-2010 extended support | Basic 1516-2010 | Full coverage of all XML elements | Better compatibility |
| 2.5 | Duplicate detection improvements | Merges duplicates silently | User-visible alerts with accept/reject | Transparency |
| 2.6 | Parser unit tests | Only integration tests via Puppeteer | Vitest unit tests for every parser method | Faster test feedback |

### 3. UI/UX
| # | Enhancement | Current | Target | Impact |
|---|-------------|---------|--------|--------|
| 3.1 | Virtual scrolling (tree views) | Full DOM for all items | Only visible rows rendered | Critical for 1000+ classes |
| 3.2 | Resizable sidebar | Fixed 300px | Draggable splitter | UX flexibility |
| 3.3 | Column sorting in detail tables | None | Click column headers to sort | Data exploration |
| 3.4 | Keyboard navigation (tabs, tree) | Partial (search panel only) | Full arrow/home/end/page nav | Accessibility |
| 3.5 | Drag-and-drop file loading | Click file picker only | Drag XML/FOM onto window | Convenience |
| 3.6 | Multi-file select | One at a time | Shift/Cmd-click in file picker | Batch loading |
| 3.7 | Recent files with timestamp | None | Store in IndexedDB | Quick reload |
| 3.8 | Tab reorder | Fixed tab order | Drag tabs to reorder | Personalization |
| 3.9 | Search with fuzzy matching | Case-insensitive substring | Fuse.js or custom fuzzy | Find typos/misspellings |
| 3.10 | Search results inline in tree | Search panel only | Type in tree filter → live filter | Faster navigation |
| 3.11 | PWA support | None | Service worker, manifest, install prompt | Desktop app feel |
| 3.12 | Detail panel pinned items | None | Pin items for side-by-side comparison | Comparison workflows |

### 4. Data Visualization
| # | Enhancement | Current | Target | Impact |
|---|-------------|---------|--------|--------|
| 4.1 | UML class diagram | None | SVG hierarchy visualization (d3.js or custom) | Visual understanding of FOM |
| 4.2 | FOM diff/comparison | None | Side-by-side diff between loaded modules | Identify changes |
| 4.3 | JSON/CSV export of merged data | Text export only | Formatted JSON, CSV, structured XML | Interoperability |
| 4.4 | Data type dependency graph | None | Graph visualization (which types use which) | Dependency analysis |
| 4.5 | Inheritance view | Tree sidebar only | Visual inheritance ladder for a selected class | Class hierarchy clarity |
| 4.6 | Attribute/parameter usage heatmap | None | Show which attributes are most/least used | Impact analysis |

### 5. Performance
| # | Enhancement | Current | Target | Impact |
|---|-------------|---------|--------|--------|
| 5.1 | Web Worker parsing | Main thread | Worker thread | 5-10x perceived performance |
| 5.2 | Debounced search | Immediate on every keystroke | 150ms debounce | Reduces jank |
| 5.3 | Lazy tab rendering | All tabs rendered | Svelte `<svelte:component>` lazy | Faster initial load |
| 5.4 | DOM recycling (virtual scroller) | Full list in DOM | Virtual scroller | Memory for 10K+ items |
| 5.5 | Svelte 5 compiled output | N/A | Optimal updates | Skip diffing entirely |

### 6. Accessibility
| # | Enhancement | Current | Target | Impact |
|---|-------------|---------|--------|--------|
| 6.1 | ARIA roles/labels | None | Tree role, tablist, aria-label everywhere | Screen reader support |
| 6.2 | Focus management | None | Focus trap in modals, focus ring on keyboard nav | Keyboard users |
| 6.3 | High contrast theme | Dark/light only | Forced-colors media query | Visual accessibility |
| 6.4 | Reduced motion | None | `prefers-reduced-motion` | Motion sensitivity |
| 6.5 | Font size scaling | 14px fixed | Relative units, user-scalable | Low vision |

### 7. Developer Experience
| # | Enhancement | Current | Target | Impact |
|---|-------------|---------|--------|--------|
| 7.1 | Hot Module Replacement | Rebuild entire file | Instant HMR with Vite | Dev speed |
| 7.2 | TypeScript via JSDoc | No types | `// @ts-check` JSDoc annotations | Catch type errors |
| 7.3 | Unit tests via Vitest | Puppeteer-only | Vitest for pure functions + Puppeteer for E2E | Fast feedback |
| 7.4 | Code quality tools | ESLint only | ESLint + Prettier + lefthook | Consistent code |
| 7.5 | Source maps in production | Optional flag | Always on | Debug production issues |
| 7.6 | Documentation component preview | None | Component-level README per component | Onboarding |

### 8. Distribution
| # | Enhancement | Current | Target | Impact |
|---|-------------|---------|--------|--------|
| 8.1 | Dockerfile for server hosting | None | Nginx-alpine serving fom-viewer.html | Server deployment |
| 8.2 | GitHub Pages deployment | None | Auto-deploy to `gh-pages` branch | Hosted demo |
| 8.3 | Electron wrapper | None | Optional `electron/` dir in repo | Desktop app |
| 8.4 | Release asset naming | `dist/fom-viewer.html` | Named with version: `fom-viewer-v2.0.0.html` | Release clarity |
| 8.5 | NPM package for CI | Not versioned | `@namespace/fom-viewer` for CI downloads | CI integration |

### 9. Bug Fixes (Already Documented)
| # | Issue | Status |
|---|-------|--------|
| 9.1 | 86 redundant comment lines in HTML template | Pending |
| 9.2 | `state.uiState` dead property | Pending |
| 9.3 | `state.conflicts`/`state.errors` deprecated but still used | Pending |
| 9.4 | Timer retry pattern for scrollIntoView | Pending |
| 9.5 | Inconsistent optional chaining (`?.`) | Pending |
| 9.6 | Missing semicolons | Pending |

---

## Architectural Blueprint — Svelte 5 Component Tree

```
main.js (entry point, 50 lines)
├── App.svelte
│   ├── Header.svelte
│   │   ├── GlobalSearch.svelte
│   │   ├── FileControls.svelte
│   │   ├── ThemeToggle.svelte
│   │   └── AppspaceControls.svelte
│   ├── TabBar.svelte
│   │   ├── Tab.svelte (×12)
│   │   └── SubtabBar.svelte
│   │       └── Subtab.svelte
│   ├── MainLayout.svelte
│   │   ├── Sidebar.svelte
│   │   │   ├── SidebarHeader.svelte (search + toggle)
│   │   │   └── TreeView.svelte (virtual scroller)
│   │   │       ├── TreeItem.svelte (recursive)
│   │   │       ├── ModuleList.svelte
│   │   │       ├── IssueList.svelte
│   │   │       └── DataTypeList.svelte
│   │   └── DetailPanel.svelte
│   │       ├── DetailHeader.svelte
│   │       ├── PropertyTable.svelte (generic)
│   │       ├── Breadcrumb.svelte
│   │       ├── UsedByTable.svelte
│   │       ├── RelatedIssues.svelte
│   │       └── TypeRenderer/*.svelte
│   │           ├── ObjectDetail.svelte
│   │           ├── InteractionDetail.svelte
│   │           ├── BasicTypeDetail.svelte
│   │           ├── SimpleTypeDetail.svelte
│   │           ├── ArrayTypeDetail.svelte
│   │           ├── FixedRecordDetail.svelte
│   │           ├── EnumTypeDetail.svelte
│   │           ├── VariantTypeDetail.svelte
│   │           ├── DimensionDetail.svelte
│   │           ├── TransportationDetail.svelte
│   │           ├── NoteDetail.svelte
│   │           ├── SwitchDetail.svelte
│   │           ├── TagDetail.svelte
│   │           └── TimeDetail.svelte
│   ├── SearchPanel.svelte
│   ├── IssueDetailModal.svelte
│   ├── AppspacePanel.svelte
│   ├── WelcomeScreen.svelte
│   ├── AppspaceFormatModal.svelte
│   └── Toast.svelte
├── stores/
│   ├── fomStore.svelte.js   (merged FOM state)
│   ├── uiStore.svelte.js    (tabs, subtabs, selection)
│   ├── historyStore.svelte.js (back nav)
│   ├── appspaceStore.svelte.js
│   ├── searchStore.svelte.js
│   └── issueStore.svelte.js
├── lib/
│   ├── FOM-Parser/
│   │   ├── index.js         (entry + parse orchestration)
│   │   ├── parseModelIdentification.js
│   │   ├── parseObjectClasses.js
│   │   ├── parseInteractionClasses.js
│   │   ├── parseDataTypes.js
│   │   ├── parseDimensions.js
│   │   ├── parseTransportations.js
│   │   ├── parseNotes.js
│   │   ├── parseSwitches.js
│   │   ├── parseTags.js
│   │   ├── parseTime.js
│   │   └── buildFullName.js
│   ├── merge.js              (mergeClasses, mergeDataTypes, etc.)
│   ├── validation.js          (validate, _checkConflicts, _checkCrossReferences)
│   ├── search.js              (search across all FOM data)
│   ├── export.js              (export functionality)
│   ├── storage.js             (IndexedDB operations)
│   ├── sanitize.js            (XSS-safe string helpers)
│   └── utils.js               (sort, filter, deduplicate)
└── worker.js                  (Web Worker entry)
```

### State Architecture (Svelte 5 Runes)

```js
// stores/fomStore.svelte.js — reactive state, no manual updateUI()
let files = $state([]);
let mergedFOM = $state(null);

// Derived — auto-recomputes when files change
let objectCount = $derived(mergedFOM?.objectClasses?.length ?? 0);
let allClassNames = $derived.by(() => {
  // compute union of all classes across all files
});

// Effect — auto-runs when dependencies change
$effect(() => {
  if (files.length > 0) {
    // re-merge, re-validate automatically
  }
});
```

---

## Phased Implementation Plan

### Phase 1: Foundation — Build System & Svelte Scaffold
**Goal:** Replace the build pipeline, get a working Svelte app rendering the current UI.

**Tasks:**
1.1. Replace build.js with Vite + `@sveltejs/vite-plugin-svelte`
1.2. Configure `vite-plugin-singlefile` for single HTML output
1.3. Create `src/App.svelte` — mount point
1.4. Port `styles.css` to Svelte global styles
1.5. Port Header + TabBar as Svelte components
1.6. Port WelcomeScreen as Svelte component
1.7. Verify: app loads, header renders, tabs render, welcome shows

**Test:** Page loads without errors, all header controls present

### Phase 2: State & Store Layer
**Goal:** Reactive state management replacing the `state` object.

**Tasks:**
2.1. Create `stores/fomStore.svelte.js`
2.2. Create `stores/uiStore.svelte.js`
2.3. Create `stores/historyStore.svelte.js`
2.4. Create `stores/issueStore.svelte.js`
2.5. Port `storage.js` (IndexedDB) — separate from UI
2.6. Verify: persistence round-trip works

**Test:** Load files, refresh page, files restored from IndexedDB

### Phase 3: Parser Refactor
**Goal:** Split FOMParser into focused modules with unit tests.

**Tasks:**
3.1. Split FOMParser into `lib/FOM-Parser/*.js` modules
3.2. Port merge logic to `lib/merge.js`
3.3. Port validation logic to `lib/validation.js`
3.4. Port `export.js` 
3.5. Wire up Web Worker for parse offloading
3.6. Write Vitest unit tests for each parser module
3.7. Write Vitest unit tests for merge + validation

**Test:** All 8 test FOM files parse identically to current output

### Phase 4: TreeView — Virtual Scrolling
**Goal:** Efficient tree rendering for 1000+ items.

**Tasks:**
4.1. Create `TreeView.svelte` with virtual scroller
4.2. Create `TreeItem.svelte` — recursive expandable node
4.3. Create `IssueList.svelte`, `DataTypeList.svelte`, `ModuleList.svelte`
4.4. Port sidebar filter (`treeFilter`)
4.5. Port sort toggle
4.6. Port tree expand/collapse
4.7. Ensure `scrollIntoView({ block: 'nearest' })` works with virtual scroller

**Test:** Tree items render, selection works, scroll behavior correct

### Phase 5: Detail Panel — Type Renderers
**Goal:** Port `renderDetail()` into component-per-type.

**Tasks:**
5.1. Create `DetailPanel.svelte` — container with breadcrumb + sections
5.2. Create `PropertyTable.svelte` — generic key-value table
5.3. Create `UsedByTable.svelte` — cross-reference display
5.4. Create `RelatedIssues.svelte` — bi-directional issue linking
5.5. Create all 14 type renderers in `TypeRenderer/`
5.6. Port embedded `onclick` "clickable-item" navigation to Svelte event callbacks

**Test:** Every type (object, interaction, enum, array, etc.) shows correct detail

### Phase 6: Search Panel
**Goal:** Port global search with Svelte transitions.

**Tasks:**
6.1. Create `SearchPanel.svelte` with slide-in transition
6.2. Port keyboard navigation (Arrow keys, Enter, Escape)
6.3. Port result grouping by type
6.4. Add hover tooltips with context snippets
6.5. Port back-button integration for search results
6.6. Add query highlighting in detail panel

**Test:** All 6 search tests pass (SearchFunctionality, ResultsDisplay, NavigateAndBack, etc.)

### Phase 7: Issues System
**Goal:** Port issue detail panel, empty states, subtab filtering.

**Tasks:**
7.1. Create `IssueDetailModal.svelte`
7.2. Create issue subtab filter bar (All/Errors/Warnings)
7.3. Port empty state messages
7.4. Port `navigateToLocation()` as Svelte navigation

**Test:** All 5 issues subtab tests pass

### Phase 8: Appspace Feature
**Goal:** Port appspace load/display/clear/persistence.

**Tasks:**
8.1. Create `stores/appspaceStore.svelte.js`
8.2. Create `AppspacePanel.svelte` — tables, matched classes, unknown
8.3. Port `AppspaceFormatModal.svelte` — reuse modal pattern
8.4. Port snackbar/toast as Svelte transition
8.5. Integrate with history store

**Test:** AppspaceFeature test passes

### Phase 9: Back Button — Svelte History Store
**Goal:** Replace manual history push/pop with integrated store.

**Tasks:**
9.1. Create `stores/historyStore.svelte.js` — `$state` array + `push()`/`pop()`
9.2. Wire tab changes, subtab changes, item selection into history
9.3. Port `goBack()` as store method
9.4. Auto-hide back button via `$derived`
9.5. Ensure `scrollIntoView` on restore

**Test:** All 5 back button tests pass (BackButton, BackButtonSubTabs, BackButtonEmbeddedLinks, BackButtonIssuesEmptySubtab, BackButtonFixes)

### Phase 10: Search — Enhanced Panel (Phase 6 from current plan)
**Goal:** Complete the already-planned search panel upgrade.

**Tasks:**
10.1. Dropdown overlay with grouped results
10.2. Keyboard navigation (arrow keys, Enter, Escape)
10.3. Hover tooltips with context snippets
10.4. Query text highlighting in detail panel
10.5. Back button integration from search results

**Test:** All search + keyboard tests pass

### Phase 11: Performance Tuning
**Goal:** Make the app fast for 100K-item FOM files.

**Tasks:**
11.1. Web Worker for XML parsing (if not done in Phase 3)
11.2. Debounce search input (150ms)
11.3. Lazy tab rendering with `<svelte:component>`
11.4. Benchmark with 10 largest RPR FOM files
11.5. Profile with Chrome DevTools, optimize hot spots

**Test:** Load all 8 test files in under 2 seconds

### Phase 12: Accessibility Audit
**Goal:** Screen reader support, keyboard nav, high contrast.

**Tasks:**
12.1. ARIA roles: `role="tree"`, `role="treeitem"`, `role="tablist"`, `role="tab"`
12.2. Keyboard: arrow keys in tree, Tab through tabs, Escape closes panels
12.3. Focus management: trap in modals, return focus after close
12.4. `prefers-reduced-motion` — disable animations
12.5. `forced-colors` — ensure contrast
12.6. Screen reader test with NVDA or VoiceOver

**Test:** Tab through entire app with keyboard only

### Phase 13: Data Visualization
**Goal:** UML class diagrams and FOM comparison.

**Tasks:**
13.1. Create `ClassDiagram.svelte` — SVG hierarchy renderer
13.2. Create `FomDiff.svelte` — side-by-side comparison view
13.3. Create `DependencyGraph.svelte` — data type dependency graph
13.4. Formatted export: JSON, CSV, structured XML/JSON
13.5. Add visualization toggle to relevant tabs

**Test:** Visualizations render for RPR modules

### Phase 14: Distribution & Polish
**Goal:** Docker, PWA, Electron, release artifacts.

**Tasks:**
14.1. Create `Dockerfile` — nginx-alpine serving fom-viewer.html
14.2. Add PWA manifest + service worker
14.3. Add `docs/electron.md` — optional Electron wrapper guide
14.4. GitHub Pages deploy workflow
14.5. Release artifact naming with version
14.6. Clean up: remove dead code, HTML template padding, stale comments
14.7. Update README.md, AGENTS.md for v2.0
14.8. Bump package.json to v2.0.0

**Test:** All 30+ tests pass on fresh checkout

---

## Key Design Decisions (With Alternatives)

### Decision 1: TypeScript vs JSDoc (DECIDED: Hybrid)
**Chosen: Hybrid — `types.d.ts` + JSDoc `// @ts-check` in `.js` files.**
One canonical `types.d.ts` with all FOM data shapes. Svelte components and lib modules stay `.js` with JSDoc annotations referencing the `.d.ts` file. Zero build config change. Easy future migration to full TS by renaming files.

| Approach | Setup | Type Safety | Verdict |
|----------|-------|-------------|---------|
| Full TypeScript (.ts + lang="ts") | 2-3h | ✅ Excellent | Two learning curves (Svelte + TS) |
| **Hybrid (types.d.ts + JSDoc)** | **30 min** | **⚠️ Good** | **✔ CHOSEN** |
| JSDoc only (// @ts-check) | 5 min | ❌ Weak | Not enough guardrail |

*See `docs/typescript-decision.md` for the full tradeoff analysis.*

### Decision 2: Virtual Scroller (DECIDED: svelte-window)
| Library | Size | Verdict |
|---------|------|---------|
| **svelte-window** | ~5KB | **✔ CHOSEN** — minimal API, well-tested with Svelte |
| svelte-virtual-list | ~3KB | Too few features |
| Custom | 0KB | Unnecessary wheel-reinventing |

### Decision 3: Web Worker (DECIDED: Comlink)
| Library | Size | Verdict |
|---------|------|---------|
| **Comlink** | ~5KB | **✔ CHOSEN** — RPC-style, minimal boilerplate |
| Raw postMessage | 0KB | Too tedious |
| worker-relay | ~10KB | Over-engineered for one worker |

### Decision 4: Visualization (DECIDED: Custom SVG)
| Library | Size | Verdict |
|---------|------|---------|
| **Custom SVG** | **0KB** | **✔ CHOSEN** — tree diagrams are simple positioned SVGs |
| d3.js modular | ~30KB | Overkill for hierarchy diagrams |
| Mermaid | ~100KB | Wrong tool for programmatic use |

### Decision 5: Fuzzy Search (DECIDED: Fuse.js)
| Library | Size | Verdict |
|---------|------|---------|
| **Fuse.js** | ~10KB | **✔ CHOSEN** — configurable, well-known, supports highlighting |
| Minisearch | ~6KB | Lighter but less capable |
| Custom regex | 0KB | Fails on typos and partial matches |

---

## Component Count Estimate

| Area | Components | Est. Lines |
|------|-----------|-----------|
| Shell (App, Header, TabBar, Layout) | 6 | ~200 |
| Sidebar (TreeView, lists, filter) | 8 | ~250 |
| Detail Panel + Type Renderers | 18 | ~400 |
| Modals (Search, Issue, Appspace, Format) | 4 | ~200 |
| Stores | 6 | ~300 |
| Lib (parser, merge, validation, utils) | 10 files | ~1800 |
| Styles | 1 file | ~500 |
| **Total** | ~53 | ~3650 |

Current: ~5600 (main.js + styles.css + build.js)
Target: ~3650 (Svelte components + modules)
**Net reduction: ~35% less code for more functionality.**

---

## Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Pure logic (parser, merge, validation) | Vitest | Unit tests, fast (~5s) |
| Component (Svelte) | @testing-library/svelte | Component interaction (~30s) |
| Integration (full app) | Puppeteer | E2E, same 30+ tests (~2min) |

**Current:** All tests via Puppeteer (~2min, 30 tests)
**Target:** Vitest unit tests (~5s) + Puppeteer E2E (~2min)

---

## File Structure v2.0

```
fom-viewer/
├── src/
│   ├── App.svelte
│   ├── components/
│   │   ├── Header.svelte
│   │   ├── TabBar.svelte
│   │   ├── Sidebar.svelte
│   │   ├── TreeView.svelte
│   │   ├── DetailPanel.svelte
│   │   ├── SearchPanel.svelte
│   │   ├── IssueDetailModal.svelte
│   │   ├── AppspacePanel.svelte
│   │   └── ...
│   ├── stores/
│   │   ├── fomStore.svelte.js
│   │   ├── uiStore.svelte.js
│   │   ├── historyStore.svelte.js
│   │   └── ...
│   ├── lib/
│   │   ├── FOM-Parser/
│   │   ├── merge.js
│   │   ├── validation.js
│   │   ├── search.js
│   │   ├── storage.js
│   │   └── utils.js
│   ├── worker.js
│   ├── main.js
│   └── styles.css
├── static/              (optional)
│   ├── manifest.json
│   ├── icon-192.png
│   └── icon-512.png
├── test/
│   ├── unit/
│   │   ├── parser.test.js
│   │   ├── merge.test.js
│   │   ├── validation.test.js
│   │   └── ...
│   ├── e2e/             (existing puppeteer tests)
│   │   ├── run.js
│   │   ├── *.test.js
│   │   └── ...
│   └── config.js
├── scripts/
│   └── build.js         (deleted — Vite handles this)
├── Dockerfile
├── vite.config.js
├── package.json
└── README.md
```
