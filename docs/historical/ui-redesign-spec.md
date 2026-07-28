# UI Redesign Specification

## 0. Design Decisions (Resolved)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Merged A+B: collapsed left rail (A) + card-style sections/breadcrumbs (B) | Maximizes content space for engineers while keeping hierarchy scannable |
| Theme | Light / Dark / System toggle in header bar | User choice, no lock-in |
| Responsive | Desktop first, "don't break" on mobile | Target audience is workstation engineers; no tablet-first investment |
| Overview dashboard | Yes, built in Phase B as placeholder (stub + drop zone); full implementation in Phase E | Avoids blank main area between phases; release-safe at any stage |
| Sidebar width | Resizable via drag handle, persist to localStorage | Simple persistence, no IndexedDB dependency |
| Filter chips | Show counts (e.g. "Basic (24)") | Instant density awareness |
| Overflow menu | Svelte component (OverflowMenu.svelte) | Consistent with component architecture |
| Virtual tree | Extend VirtualList with depth-flattened mode | Avoids duplicating scroll logic |
| Left rail section labels | Visual grouping via separators only, no text labels when collapsed | Text labels waste space when expanded; tooltips suffice |
| Rail hover behavior | Overlay on hover, push when pinned | No permanent layout cost; pin is deliberate (Q1) |
| Theme bar | Replace existing ☀️ button with Light/Dark/System `<select>` in-header | No new chrome; users know where theme lives (Q2) |
| Chip row height | Fixed 48px reserved space, even when no chips active | Zero layout shift on tab switch (Q4) |
| CollapsibleSection threshold | Auto-skip when children < 6; apply thin (borderless) styling universally | Reduces visual noise for small records; thin style makes inconsistency feel intentional (Q5) |
| Keyboard shortcuts | Ctrl+F / `/` = search; Ctrl+Shift+1..9 = tabs; Ctrl+B = sidebar toggle (override browser defaults where possible) | Rich web app standard; browser escape hatch documented (Q6) |
| Mobile layout <480px | Same layout, smaller text/padding; rail stays 48px, no structural change | Desktop-first tool; "don't break" ≠ optimize (Q7) |
| Stats computation | Eager, on file load/remove/clear, stored in `statsStore` | Free alongside existing traversal; no reactivity overhead (Q8) |
| IndexedDB migration | Seed `recent-files` from existing `fom-cache` on first migration; skew timestamps −1s per file | Immediate fidelity, no empty-list fiction (Q9) |
| Tab icons | Inline Lucide SVGs in `src/lib/icons.js`; see §11 | Professional, consistent, zero dependencies (Q11) |
| Theme default | "System" (respects `prefers-color-scheme`); attribute-only migration skipped | Right for new users, no migration code (Q12) |
| Search highlighting | Persists until search closed (Escape); `HighlightedText` reads store reactively, no DOM observation needed | Natural Svelte approach (Q13) |
| Sidebar resize | CSS `resize: horizontal` in Phase A; JS + localStorage persistence in Phase D | Ships fast, persistence is additive (Q14) |
| Overview default | Hard default, no opt-out | One-click cost is same as any tab switch; revisit if feedback demands it (Q15) |
| Overview scroll & history | Reset to top on visit, no history push | Dashboard is top-down scan; avoids back-button cycle (Q10) |

## 1. Context & Existing Exploration

Four prior mockups were created and later removed. Their ideas were salvageable:

| File | Theme | Key Ideas | Fate |
|------|-------|-----------|------|
| `mockup.html` | Issue grouping | Category headers, severity dots, source badges | Implemented in IssueList.svelte |
| `mockup-ide-style.html` | VS Code IDE | Activity bar concept, right properties panel | Absorbed into mockup-rail-dark.html |
| `mockup-modern-minimal.html` | Modern minimal | Gradient header, rounded cards | Absorbed into mockup-rail-light.html |
| `mockup-dashboard.html` | Data dashboard | Stats cards, metric grid, recent files | Replaced by mockup-dashboard.html (new) |

**Replacement mockups (in repo root):**

| File | Description |
|------|-------------|
| `mockup-rail-dark.html` | Option A standalone: collapsed left rail, filter chips, dark theme |
| `mockup-rail-light.html` | Option B standalone: expanded rail, hierarchy tree, light theme |
| `mockup-dashboard.html` | Option C standalone: overview/dashboard landing page |
| `mockup-recommended.html` | **Final merged A+B**: collapsed rail + card sections + breadcrumbs + live theme toggle (Light/Dark/System) |

All four prior mockups share the same fundamental layout (header + horizontal tab bar + sidebar + detail panel). None address:

- Tab bar overload (14+ items, horizontal scrolling)
- Three separate sub-tab bars appearing/disappearing
- No progressive disclosure in detail panels
- Fixed-width sidebar (300px, not resizable)
- No responsive breakpoints
- No keyboard shortcut system
- Search highlighting via DOM mutation (setTimeout-driven)

## 2. Target Layout

### 2.1 Current Layout

```
+-------------------------------------------------------+
| Header: [FOM Viewer] [Back] [Search] [Load][Export]   |
+-------------------------------------------------------+
| [Modules][Objects][Interactions][Dims][Trans]...       | <- horizontal scroll
+-------------------------------------------------------+
| [Basic][Simple][Array][Fixed][Enum][Variant]           | <- subtab bar (DT only)
+--------------------+----------------------------------+
| Sidebar (300px)    | Detail Panel                     |
| [filter]           | [breadcrumb]                     |
| + item             | Property table                   |
| + item             | Attributes/parameters             |
| ...                | Usage/cross-refs                  |
|                    |                                  |
+--------------------+----------------------------------+
```

### 2.2 Merged A+B Layout (Phases A-D)

```
+-----------------------------------------------------------+
| Theme: [Light|Dark|System]                                 | <- new theme bar
+-----------------------------------------------------------+
| Header: [menu] [FOM Viewer] [Search /] [Back] [Sort] [... | <- consolidated
+---------+-------------------------------------------------+
| Left    | Content Area                                     |
| Rail    | +------------------+---------------------------+ |
| (48px)  | | Sidebar          | Detail Panel              | |
| icons   | | [filter]         | [breadcrumb]              | |
| +----+  | | [sort]           | +------------------------+ | |
| | OB |  | | + item           | | Class Info (card)      | | |
| | IN |  | | + item           | | ....................... | | |
| | DT |  | | <resizable>      | | Attributes (card)      | | |
| | .. |  | |                  | | ....................... | | |
| | IS |  | |                  | | Inherited (collapsed)  | | |
| +----+  | |                  | | Issues (collapsed)     | | |
|         | |                  | +------------------------+ | |
|         | +------------------+---------------------------+ |
+---------+-------------------------------------------------+
```

**Key changes:**
- Tab bar -> vertical left rail (48px icons, tooltip on hover). Collapsed by default, expands to 200px on hover (CSS overlay, no reflow). Pin button for persistent expansion. localStorage persistence.
- Sub-tab bars removed -- replaced by filter chips within sidebar (e.g., Data Types: [Basic (24)] [Simple (16)] [Array (8)] ...)
- Header consolidated: secondary actions (Export, Clear, About, Load Appspace) behind "..." overflow menu. Primary actions (Load FOM, Back, Search) stay visible.
- Sidebar is resizable via drag handle (200-500px range)
- Detail panel uses card-style collapsible sections with breadcrumb navigation
- Light/Dark/System theme toggle via theme bar below header, using CSS custom properties and prefers-color-scheme media query

### 2.3 Phase E: Overview Dashboard

Same base layout as 2.2, but adds an "Overview" tab (house icon) as the first item in the left rail. Active by default when no FOM files are loaded.

```
+---------+-------------------------------------------------+
| Left    | Dashboard                                       |
| Rail    | +--------+--------+--------+--------+--------+  |
| (48px)  | | Stats  | Stats  | Stats  | Stats  | Stats  |  |
| +----+  | | 156 Ob | 42 Int | 412 DT | 8 Mod  | 12 Iss |  |
| |HOME|  | +--------+--------+--------+--------+--------+  |
| | OB |  | +---------------------------+------------------+  |
| | IN |  | | Recent Files             | Issue Summary    |  |
| | DT |  | | RPR-Foundation (2:30PM)  | Cross-ref: 5     |  |
| | .. |  | | RPR-Physical  (2:28PM)   | Conflicts: 4     |  |
| | IS |  | | HLAstandardMIM (3PM)     | Circular: 1      |  |
| +----+  | +---------------------------+------------------+  |
|         | | [Open FOM] [Load Last] [Docs] [Appspace]   |  |
|         | | Drop zone: Drag XML files here              |  |
|         | +---------------------------------------------+  |
+---------+-------------------------------------------------+
```

**Dashboard components:**
- Stats cards (object classes, interactions, data types, modules, issues) -- computed from mergedFOM store
- Recent files -- loaded from new IndexedDB history store
- Issue breakdown with horizontal percentage bars -- computed from issueStore
- Quick action buttons -- Open FOM, Load Last Session, Documentation, Load Appspace
- Drop zone -- existing WelcomeScreen drop area, reused

**No stats for "none selected" empty state** -- the Overview IS the default landing.

## 3. Component Changes

### 3.1 Header.svelte

| Change | Details |
|--------|---------|
| Add sidebar toggle button (hamburger) | Leftmost position, emits toggleSidebar |
| Consolidate overflow | Move Export, Sort, Clear, About, Load Appspace behind a "..." dropdown |
| Back button | Keep visible, move to left of search |
| Search placeholder | Update to "Search... (Ctrl+F or /)" |
| Separators | Remove -- overflow menu handles grouping |
| Theme selector | Move to a thin bar above header (appears below the existing header, persists across pages) |

**New component:** OverflowMenu.svelte -- simple dropdown with grouped items.

**Theme bar implementation:**
- `<select>` with three options: Light, Dark, System
- System option listens to `window.matchMedia('(prefers-color-scheme: dark)')` and updates reactively
- Persists choice to localStorage
- Applies `data-theme` attribute to `<html>` element
- CSS custom properties switch entirely on `[data-theme="light"]` vs `[data-theme="dark"]`

### 3.2 TabBar.svelte -> LeftRail.svelte (replace)

Replace the horizontal tab bar with a vertical navigation rail.

Props:
- `tabs: [{ id, label, icon, section, count? }]`
- `activeTab: string`
- `onTabChange: (id) => void`
- `sectionLabels: { dataModel, infrastructure, documentation }`

Behavior:
- Default collapsed: 48px wide, icons + tooltips only
- Hover: expands to 200px overlay (no reflow), shows labels
- Pin button: keeps expanded, persisted to localStorage
- Sections: grouped by data model / infrastructure / documentation
- Issues tab shows count badge when issues exist

### 3.3 SubtabBar.svelte -> Remove

The three separate sub-tab bars are removed. Their function moves to the sidebar:

- **Data Type subtabs** (basic/simple/array/fixed/enum/variant): become filter chips at top of the sidebar when Data Types tab is active
- **Appspace subtabs** (objects/interactions/unknown): become filter chips
- **Issues subtabs** (all/errors/warnings): become filter chips at top of issue list
- **Transportation subtabs**: removed (transportations are a flat list)

### 3.4 App.svelte

| Change | Details |
|--------|---------|
| Layout restructure | Replace horizontal flex with CSS grid: left-rail + content |
| Sidebar collapse state | Pass sidebarCollapsed + toggle handler to Header |
| LeftRail + sidebar | Both siblings in single grid column |
| Responsive container | Add container queries for breakpoints |
| Remove subtab conditionals | The `{#if tab === 'datatypes'}<SubtabBar/>` blocks are removed |

New grid layout:
```css
.app-layout {
  display: grid;
  grid-template-columns: var(--rail-w, 48px) 1fr;
  grid-template-rows: auto 1fr;
  height: 100vh;
}
.app-layout.rail-expanded {
  grid-template-columns: var(--rail-w-expanded, 200px) 1fr;
}
```

### 3.5 TreeView.svelte

| Change | Details |
|--------|---------|
| Virtual scrolling for trees | Flatten visible nodes (depth-first, only expanded), pass to VirtualList |
| Expandable sections | Data types grouped by category with collapsible group headers |
| Sort toggle | Move from header to sidebar toolbar area |
| "Used by" badges | Show count badge on items with usages |
| Empty state | Enhanced with icon and helpful message |

### 3.6 DetailPanel.svelte + TypeRenderers

| Change | Details |
|--------|---------|
| Progressive disclosure | Each property section wrapped in collapsible container: summary (always), details (default collapsed), advanced (collapsed) |
| Breadcrumb | Keep, make sticky at top of detail panel |
| Source module badges | Show which modules contributed at top of panel |
| Related issues | Move to collapsible "Issues" section at bottom |
| Search highlighting | Move from setTimeout/innerHTML in main.js to Svelte reactive component |

**New component:** CollapsibleSection.svelte
```svelte
<script>
  let { title, defaultOpen = false, count, summary } = $props();
  let open = $state(defaultOpen);
</script>
```

### 3.7 SearchPanel.svelte

| Change | Details |
|--------|---------|
| Keyboard shortcut | / or Ctrl+F focuses or opens |
| Overlay | Keep existing overlay behavior |
| Reactive highlighting | Replace DOM mutation in main.js with Svelte store-driven approach |
| State persistence | Optionally persist query in URL hash for back-button compat |

### 3.8 OverviewDashboard.svelte (Phase E, new)

Replaces WelcomeScreen as the default landing when no file is selected, and appears as the Overview tab (house icon, position 0 in left rail).

**Sub-components:**
- StatsGrid.svelte -- 5-column card grid with auto-computed counts from mergedFOM
- RecentFilesList.svelte -- list from IndexedDB history store, shows filename + timestamp + class/type counts
- IssueBreakdown.svelte -- category rows with percentage bars, computed from issueStore
- QuickActions.svelte -- 4-button row (Open FOM, Load Last Session, Docs, Appspace)
- DropZone.svelte -- reused from current WelcomeScreen

**States:**
- No files loaded: shows empty stats (all zeros), empty recent files, prominent drop zone
- Files loaded: shows real stats, populated recent files, issue breakdown
- No recent files history: RecentFilesList shows "No recent files -- load a FOM to get started"

**Data flow:** Reads from fomStore (stats), issueStore (issues), recentFilesStore (history). All derived. No mutations.

### 3.9 WelcomeScreen.svelte -> replaced (Phase E)

Existing WelcomeScreen is **replaced** by OverviewDashboard in Phase E.

**Migration:**
- WelcomeScreen drop zone logic (drag/drop handlers) moves to OverviewDashboard
- WelcomeScreen trending message removed (replaced by stats cards)
- Empty/loaded branching handled by OverviewDashboard internally

## 4. Store Changes

### Additions to uiStore.svelte.js

```javascript
sidebarExpanded: false,          // left rail label visibility
leftRailPinned: false,           // pin left rail open
sidebarWidth: 300,               // sidebar width in px
overflowMenuOpen: false,         // header dropdown
keyboardShortcutsEnabled: true,
theme: 'system',                 // 'light' | 'dark' | 'system'
```

**Theme behavior:**
- `theme = 'system'`: applies `data-theme` based on `matchMedia('(prefers-color-scheme: dark)')`
- `theme = 'light'` / `'dark'`: applies directly
- Persisted to localStorage key `fom-viewer-theme`

### Store Responsibilities

| Store | Owns |
|-------|------|
| fomStore | FOM data, merged FOM, file list, appspace -- unchanged |
| uiStore | Sidebar state, rail state, theme, subtab filters, overflow menu, keyboard settings |
| issueStore | Issues list, filters, selected issue -- unchanged |
| searchStore | Search query, results, selected result, highlight state -- unchanged |
| historyStore | Back-navigation stack, push/pop, scroll restoration -- unchanged |

### New: historyStore for recent files (Phase E only)

Separate from the existing navigation historyStore. Tracks file load events:

```javascript
// src/lib/stores/recentFilesStore.svelte.js
entries: [
  {
    fileName: 'RPR-Foundation_v3.0.xml',
    loadedAt: '2026-06-09T14:30:00Z',
    stats: { objectClasses: 42, interactions: 12, dataTypes: 86 }
  }
]
```

- Max 20 entries, FIFO eviction
- Persisted to IndexedDB (separate object store: `recent-files`)
- Appended on each successful FOM file load

## 5. CSS / Theme Changes

### New CSS Custom Properties

```css
--rail-width: 48px;
--rail-width-expanded: 200px;
--rail-bg: var(--bg-secondary);
--sidebar-min-width: 200px;
--sidebar-max-width: 500px;
```

### New Components to Add

| Component | Purpose | Phase |
|-----------|---------|-------|
| LeftRail.svelte | Vertical navigation rail replacing TabBar | B |
| OverflowMenu.svelte | Header dropdown for secondary actions | C |
| CollapsibleSection.svelte | Reusable collapsible container for detail panel | A |
| FilterChips.svelte | Horizontal chip group for subtab filtering | B |
| HighlightedText.svelte | Reactive search-highlighted text (replaces DOM mutation) | A |
| ThemeBar.svelte | Light/Dark/System selector bar above header | A |
| OverviewDashboard.svelte | Stats grid + recent files + issue breakdown + actions | E |
| StatsGrid.svelte | 5-column stat card row | E |
| IssueBreakdown.svelte | Category rows with percentage bars | E |
| RecentFilesList.svelte | Timestamped file history list | E |

### Components to Remove

| Component | Reason |
|-----------|--------|
| TabBar.svelte | Replaced by LeftRail.svelte |
| SubtabBar.svelte | Replaced by FilterChips.svelte in sidebar |
| WelcomeScreen.svelte | Replaced by OverviewDashboard.svelte (Phase E) |

## 6. Files to Touch

| File | Change Type |
|------|-------------|
| src/lib/Header.svelte | Major: add toggle, consolidate to overflow menu |
| src/lib/TabBar.svelte | Remove (replaced by LeftRail) |
| src/lib/LeftRail.svelte | Create |
| src/lib/SubtabBar.svelte | Remove (replaced by FilterChips) |
| src/lib/FilterChips.svelte | Create |
| src/lib/CollapsibleSection.svelte | Create |
| src/lib/HighlightedText.svelte | Create |
| src/lib/OverflowMenu.svelte | Create |
| src/lib/TreeView.svelte | Major: sectioned data types, virtual scrolling, badges |
| src/lib/VirtualList.svelte | Minor: support depth-flattened tree mode |
| src/lib/DetailPanel.svelte | Major: progressive disclosure wrapper |
| src/lib/TypeRenderer/*.svelte | Minor: wrap sections in CollapsibleSection |
| src/lib/SearchPanel.svelte | Minor: keyboard shortcut, reactive highlighting |
| src/lib/WelcomeScreen.svelte | Major: replaced by OverviewDashboard (Phase E) |
| src/lib/stores/uiStore.svelte.js | Minor: new state fields (sidebar, rail, theme) |
| src/lib/stores/recentFilesStore.svelte.js | Create (Phase E) |
| src/App.svelte | Major: grid layout, conditionals, new components |
| src/main.js | Major: remove TabBar/SubtabBar wiring, simplify showDetail |
| src/styles.css | Major: theme system with data-theme, left-rail styles, filter chips, collapsible sections |

## 7. Implementation Phases

### Phase A: Pre-work (isolated changes, no layout shift)

1. Create CollapsibleSection.svelte
2. Create HighlightedText.svelte
3. Add new state fields to uiStore
4. Wire keyboard shortcuts (/, Ctrl+F, Escape) in App.svelte
5. Verify: existing tests still pass

### Phase B: Sidebar + Rail (layout change)

6. Create LeftRail.svelte with TabBar's tab data
7. Create FilterChips.svelte
8. Restructure App.svelte to CSS grid with LeftRail
9. Remove TabBar.svelte and SubtabBar.svelte
10. Verify: all tabs still work, data type subtabs accessible via filter chips

### Phase C: Header + Detail (improvements)

11. Consolidate Header buttons to overflow menu
12. Add widget badges to detail breadcrumb
13. Wrap TypeRenderer sections in CollapsibleSection
14. Move search highlighting to HighlightedText component
15. Verify: all detail panels render correctly

### Phase D: Polish + Responsive

16. Add sidebar resize handle with drag interaction
17. Virtual scroll for tree mode (if needed)
18. Responsive breakpoints (minimal: sidebar stacks on <768px, header collapses non-essential buttons)
19. Verify: full test suite passes

### Phase E: Overview Dashboard (additive, depends on A-D)

20. Create `recentFilesStore.svelte.js` -- IndexedDB-backed load history with timestamps + stats
21. Create `StatsGrid.svelte` -- reads from mergedFOM store, 5 stat cards
22. Create `IssueBreakdown.svelte` -- reads from issueStore, category rows + bars
23. Create `RecentFilesList.svelte` -- reads from recentFilesStore, clickable entries
24. Create `OverviewDashboard.svelte` -- assembles stats + issues + recent + quick actions + drop zone, replaces WelcomeScreen
25. Add house icon (Overview) as position 0 in left rail
26. Wire tab switch: Overview active when no file loaded, or when user clicks home
27. Verify: dashboard renders with real data, recent files persist across sessions, empty states display correctly

## 8. Wireframe: LeftRail States

### Collapsed (default)
```
+--+
|MD|
|OB|
|IN|
|DT|
|--|  <- section separator
|DI|
|TR|
|SW|
...
|--|
|IS|
+--+
```

### Expanded (hover or pinned)
```
+--------+
| Modules|
| Objects|
| Interac|
| DataTy |
|--------|
| Dimen  |
| Trans  |
| Switc  |
| Tags   |
| Time   |
| Notes  |
|--------|
| Issues |
+--------+
```

### With filter chips (sidebar, data types active)
```
+----------------------------------+
| [Basic][Simple][Array][Fixed]... |  <- FilterChips.svelte
+----------------------------------+
| + HLAfloat32BE                   |
| + HLAfloat64BE                   |
| ...                              |
+----------------------------------+
```

## 9. Keyboard Shortcuts (Tentative)

| Shortcut | Action |
|----------|--------|
| / | Focus global search |
| Ctrl+F | Focus global search |
| Escape | Close search / go back / close overflow |
| 1-9 | Switch to tab by position |
| Ctrl+B | Toggle sidebar collapse |
| Ctrl+Shift+F | Focus sidebar filter |
| s | Toggle sort |
| n | Next item in tree |
| p | Previous item in tree |
| Enter | Select focused item |
| ? | Show keyboard shortcuts dialog |

## 10. Open Questions (Resolved)

All questions from §0 and the remaining question below have been resolved during design review.

| Q | Topic | Choice | Rationale |
|---|-------|--------|-----------|
| 16 | Sort toggle location | Sidebar toolbar (Phase C) | Header = app-level; sidebar = tree-level (separation of concerns) |

## 11. Icon Reference (Lucide, inline SVGs)

| Component | Lucide Name | Description |
|-----------|-------------|-------------|
| Overview | `layout-dashboard` | Dashboard grid |
| Modules | `package` | Box with lid |
| Objects | `box` | 3D isometric cube |
| Interactions | `message-square` | Chat bubble |
| Data Types | `code` | Angle brackets |
| Dims | `move-3d` | 3D axis arrows |
| Trans | `truck` | Delivery vehicle |
| Notes | `file-text` | Document with text lines |
| Switches | `toggle-left` | Toggle switch |
| Tags | `tag` | Label/tag |
| Time | `clock` | Clock face |
| Appspaces | `panels-top-left` | Layout panels |
| Issues | `circle-alert` | Circle with exclamation |
| Search | `search` | Magnifying glass |
| Theme | `sun` / `moon` | Swapped based on active theme |
| Overflow | `ellipsis` | Three dots |

All icons stored in `src/lib/icons.js` as inline SVG strings. No external icon library at runtime.

## 12. Mockup Reference

| Mockup File | Shows | Location |
|-------------|-------|----------|
| `mockup-rail-dark.html` | Option A: collapsed left rail, filter chips, dark theme | Repo root |
| `mockup-rail-light.html` | Option B: expanded rail, hierarchy tree, light theme | Repo root |
| `mockup-dashboard.html` | Option C: overview dashboard landing page | Repo root |
| `mockup-recommended.html` | **Final merged A+B**: collapsed rail + card sections + breadcrumbs + theme toggle | Repo root |

Open any mockup in a browser to view. `mockup-recommended.html` has a live theme selector.

