# Appspace Feature - Test Cases

## Overview
Test cases for the Appspace feature in FOM Viewer.

---

### TC-001: Load Appspace Button Visible
- **Steps**: Open FOM Viewer
- **Expected**: "Load Appspace" button is visible in header
- **Expected**: "Clear Appspace" button is hidden
- **Expected**: `exportAppspaceSeparator` is hidden (display: none)
- **Expected**: `loadAppspaceSep` is hidden (display: none)
- **Expected**: `appspaceSeparator` is hidden (display: none)

### TC-002: Load Valid Appspace File
- **Steps**: Click "Load Appspace", select valid .appspace file
- **Expected**: Button text changes to "Change Appspace"
- **Expected**: "Clear Appspace" button becomes visible
- **Expected**: `exportAppspaceSeparator` becomes visible
- **Expected**: `loadAppspaceSep` becomes visible
- **Expected**: `appspaceSeparator` becomes visible
- **Expected**: Appspaces tab appears in tab bar
- **Expected**: Tab switches to "Appspaces" tab automatically

### TC-003: Clear Appspace
- **Steps**: Load appspace file, then click "Clear Appspace"
- **Expected**: Button text changes back to "Load Appspace"
- **Expected**: "Clear Appspace" button is hidden
- **Expected**: All separators are hidden (display: none)
- **Expected**: Appspaces tab is hidden
- **Expected**: If on Appspaces tab, switches to FOM Modules tab

### TC-004: Appspaces Tab - Objects Subtab
- **Steps**: Load appspace file, go to Appspaces tab
- **Steps**: Click "Objects" subtab
- **Expected**: Shows matched object classes with links
- **Expected**: Each entry shows class name and applications list

### TC-005: Appspaces Tab - Interactions Subtab
- **Steps**: Load appspace file, go to Appspaces tab
- **Steps**: Click "Interactions" subtab
- **Expected**: Shows matched interaction classes with links
- **Expected**: Each entry shows class name and applications list

### TC-006: Appspaces Tab - Unknown Subtab
- **Steps**: Load appspace file, go to Appspaces tab
- **Steps**: Click "Unknown" subtab
- **Expected**: Shows unmatched entries (red styling)
- **Expected**: No links (unmatched classes)

### TC-027: Appspace Sorting - Ascending Order
- **Steps**: Load an appspace file with multiple entries
- **Steps**: Click the Sort button to enable ascending sort (state.sortEnabled = 'asc')
- **Steps**: Navigate to Objects subtab
- **Expected**: Entries are sorted alphabetically by class name (A → Z)
- **Steps**: Navigate to Interactions subtab
- **Expected**: Entries are sorted alphabetically by class name (A → Z)
- **Steps**: Navigate to Unknown subtab
- **Expected**: Entries are sorted alphabetically by class name (A → Z)

### TC-028: Appspace Sorting - Descending Order
- **Steps**: Load an appspace file with multiple entries
- **Steps**: Click the Sort button twice to enable descending sort (state.sortEnabled = 'desc')
- **Steps**: Navigate to Objects subtab
- **Expected**: Entries are sorted reverse alphabetically by class name (Z → A)
- **Steps**: Navigate to Interactions subtab
- **Expected**: Entries are sorted reverse alphabetically by class name (Z → A)
- **Steps**: Navigate to Unknown subtab
- **Expected**: Entries are sorted reverse alphabetically by class name (Z → A)

### TC-029: Appspace Sorting - Disabled
- **Steps**: Load an appspace file with multiple entries
- **Steps**: Click the Sort button three times to disable sorting (state.sortEnabled = false)
- **Steps**: Navigate to Objects subtab
- **Expected**: Entries are displayed in original order (as parsed from appspace file)
- **Steps**: Navigate to Interactions subtab
- **Expected**: Entries are displayed in original order
- **Steps**: Navigate to Unknown subtab
- **Expected**: Entries are displayed in original order

### TC-030: Sort Button Persists Acress Subtabs
- **Steps**: Load an appspace file
- **Steps**: Click Sort button to enable ascending sort
- **Steps**: Switch between Objects, Interactions, Unknown subtabs
- **Expected**: Sorting remains applied (entries sorted in all subtabs)
- **Steps**: Click Sort button to change to descending
- **Expected**: All subtabs now show descending sort
- **Steps**: Click Sort button again to disable
- **Expected**: All subtabs show original order

### TC-031: Multiple Space-Delimited Note References
- **Steps**: Load FOM files that have attributes/enums with multiple note references (space-delimited)
- **Example**: An attribute with `notes="NOTE1 NOTE2 NOTE3"` (space-delimited)
- **Expected**: Each note reference gets its own 📝 icon
- **Expected**: Each icon links to the correct note in the Notes tab
- **Expected**: Each icon has a tooltip with the note's semantics (truncated to 100 chars)
- **Expected**: If a note is not found, a ⚠️ icon appears with "Note not found: [noteName]"
- **Test**: Check attributes, enumerators, alternatives, and fields for multiple note icons

### TC-032: Single Note Reference Still Works
- **Steps**: Load FOM files with single note references
- **Example**: An attribute with `notes="NOTE1"`
- **Expected**: One 📝 icon appears (not multiple)
- **Expected**: Clicking the icon navigates to the correct note in Notes tab
- **Expected**: Tooltip shows the note semantics correctly

### TC-033: Note Icon Placement in Tables
- **Steps**: Load FOM files and check various tables:
  - Object/Interaction class detail (item.notes)
  - Attributes table (attr.notes)
  - Parameters table (param.notes)
  - Enumeration values table (value.notes)
  - Alternatives table (alt.notes)
  - Fields table (field.notes)
- **Expected**: Note icons appear next to the name in each table
- **Expected**: Multiple note references show multiple icons
- **Expected**: All icons are clickable and link to the Notes tab

### TC-034: Load Appspace Switches to Appspaces Tab
- **Steps**: Select an item in a tab (e.g., Object Classes tab, select "HLAobjectRoot.DynamicObject")
- **Steps**: Click "Load Appspace" button
- **Steps**: Select a valid .appspace file
- **Expected**: Tab automatically switches to "Appspaces" tab
- **Expected**: Appspaces tab shows the loaded file data
- **Expected**: Previous tab selection is no longer active

### TC-035: Cancel File Load Preserves State
- **Steps**: Select an item in a tab (e.g., Objects tab, select "HLAobjectRoot.DynamicObject")
- **Steps**: Click "Load Appspace" button
- **Steps**: Click "Cancel" in the file picker dialog
- **Expected**: Original tab remains selected (e.g., Objects tab still active)
- **Expected**: Originally selected item is still selected
- **Expected**: No appspace is loaded (state.appspace remains null)
- **Expected**: Appspaces tab remains hidden (if it was hidden before)

### TC-036: History Preserved on Cancel
- **Steps**: Navigate to some items to build history (click through a few items)
- **Steps**: Click "Load Appspace" button
- **Steps**: Click "Cancel" in the file picker dialog
- **Expected**: Back button history is preserved (same as before)
- **Expected**: Can still use Back button to navigate through history

### TC-037: Spacers Visible on Both Sides of Load Appspace
- **Steps**: Load an appspace file
- **Expected**: `exportAppspaceSeparator` visible (spacer between Export and Load Appspace)
- **Expected**: `appspaceSeparator` visible (spacer between Load Appspace and Theme button)
- **Expected**: No separator between "Change Appspace" and "Clear Appspace" buttons
- **Steps**: Clear the appspace
- **Expected**: `appspaceSeparator` hidden (display: none)
- **Expected**: `exportAppspaceSeparator` remains visible (always shown)

### TC-038: Spacer Visibility Without Appspace
- **Steps**: Open page without loading appspace
- **Expected**: `exportAppspaceSeparator` is visible (always shown as spacer)
- **Expected**: `appspaceSeparator` is hidden (display: none)
- **Expected**: Only "Load Appspace" button is visible (no "Clear Appspace")
