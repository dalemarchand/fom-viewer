# Future Enhancements

This file captures feature ideas that were considered but deferred during implementation.

---

## Tree View Virtual Scrolling

**Origin**: v3 UI Redesign plan, task 4.2 (dropped as not needed for current scale)

### Problem
The tree view renders all items into the DOM at once. With very large FOM files (10K+ classes/attributes), this could cause performance issues — slow initial render, high memory usage, sluggish scrolling.

### Current State
- The `.tree-wrapper` container uses native `overflow-y: auto` scrolling
- All tree items are always in the DOM
- `scrollIntoView({ block: 'nearest' })` is used after selection/back navigation
- This works fine for typical FOM files (<1K items)

### Implementation Notes (if revisited)
- Rewrite TreeView.svelte to render only visible rows (windowed list)
- Must handle variable-height rows (children indent, multi-line names)
- Must integrate with `scrollIntoView` for back navigation restoration
- Must work with the tree filter (which currently shows/hides via CSS `display:none`)
- Fixed-height rows would simplify significantly (but break nesting depth indentation)
- Consider `virtual-scroll` or built-in browser `content-visibility: auto` as lighter alternatives

### Trigger to Revisit
- Real-world FOM files with >3000 items in a single tree view
- Measured frame drops or jank during scrolling
- Memory usage concerns in constrained environments
