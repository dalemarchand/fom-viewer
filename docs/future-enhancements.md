# Future Enhancements

This file captures feature ideas that were considered but deferred during implementation.

---

## Tree View Rendering Optimization

**Origin**: v3 UI Redesign plan, task 4.2 (dropped as not needed for current scale)

### Problem
The tree view renders all items into the DOM at once. With very large FOM files (10K+ classes/attributes), this could cause performance issues — slow initial render, high memory usage, sluggish scrolling.

### Current State
- The `.tree-wrapper` container uses native `overflow-y: auto` scrolling.
- All tree items are always in the DOM.
- `scrollIntoView({ block: 'nearest' })` is used after selection/back navigation.
- This works fine for typical FOM files (<1K items).

### Implementation Notes (if revisited)
- Consider using browser-native **`content-visibility: auto`** and **`contain-intrinsic-size`** CSS properties on tree node wrappers as a lightweight alternative to avoid rewriting Svelte components.
- If rendering windowing is strictly required, rewrite `TreeView.svelte` to render only visible rows, ensuring it handles child indentation levels and dynamic row heights.

### Trigger to Revisit
- Real-world FOM files with >3000 items in a single tree view.
- Measured frame drops or scroll jank.

---

## Full TypeScript Migration for Svelte Components

**Origin**: v3.1.0 Hybrid TypeScript upgrade

### Problem
Svelte components (`src/lib/*.svelte`) currently remain untyped plain JavaScript files. Svelte compiler errors inside tags are not validated during linting or type-checking.

### Current State
- Core business logic (`validation.js`, `merge.js`, `storage.js`) is typechecked via `tsc --noEmit` and ambient type definitions in `src/types.d.ts`.
- Components do not yet enforce type boundaries on props or local states.

### Implementation Notes
- Rename Svelte scripts to use `<script lang="ts">`.
- Interface properties (`export let ...`) or `$props()` using TypeScript type syntax.
- Integrate `svelte-check` validation back into `package.json`'s `typecheck` script.

---

## Responsive Navigation Drawer

**Origin**: Visual aesthetics review

### Problem
The split-pane layout is desktop-optimized. On mobile/tablet viewports, the side-by-side layout becomes highly cramped.

### Current State
- The viewport handles width constraints using simple CSS media queries, but retains the side-by-side tree and detail panel division.

### Implementation Notes
- Design a responsive side navigation drawer that slides out on mobile.
- Use a single-pane viewport navigation on mobile screens, switching between Tree list view and Details panel view when an item is selected.

---

## Advanced Search Facets and Filters

**Origin**: Search usability feedback

### Problem
Searching globally via Fuse.js returns all matching entities in a flat list. On massive FOM files, finding the target type can require excessive scrolling.

### Current State
- Fuse.js performs query matching across names and descriptions.

### Implementation Notes
- Add toggleable filter chips in the search UI to filter results by type (e.g., "Only Objects", "Only Interactions", "Only Data Types").
- Support search filters to target matching elements within specific FOM XML module names.
