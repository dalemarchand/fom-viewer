# Appspace Feature - Combined Requirements

## Overview
Add ability to assign appspaces to HLA object and interaction classes, loaded from a separate file. The appspaces are displayed in two places:
1. A dedicated Appspaces tab showing all associations in table format
2. The Class Information section for each object/interaction class showing its specific appspaces

## 1. File Format

### Line Format
```
<className>|<app1,app2,...>
```

- **Field delimiter**: Pipe (`|`) separates class name from app list
- **App delimiter**: Comma (`,`) separates multiple apps for same class
- Lines starting with `#` are comments and ignored

### Example File
```
# Example appspace file
HLAobjectRoot.BaseEntity.EmbeddedSystem.Minefield|MinefieldApp,SensorApp
HLAobjectRoot.BaseEntity.Platform.EmbeddedSystem|PlatformApp
HLAinteractionRoot.Platform.EmbeddedSystem.Detonation|weapons,minefield
```

## 2. Matching Rules

### Hierarchy Building
- Build full hierarchical class names using `.` separator
- Example: `HLAobjectRoot.BaseEntity.PhysicalEntity.Platform.Minefield`

### Matching Logic
- Match file entry against the RIGHT part of full class name
- Most specific match wins (longest right-side match)
- Example: File entry `BaseEntity.PhysicalEntity` checked against:
  - `HLAobjectRoot.BaseEntity` → No match (too short)
  - `HLAobjectRoot.BaseEntity.PhysicalEntity` ✓ MATCH (exact)
  - `HLAobjectRoot.BaseEntity.PhysicalEntity.Platform` → No match (file entry shorter than full)

## 3. UI Components

### 3.1 Header Controls

#### Vertical Separators
Add vertical separator elements (`<div class="header-separator"></div>`) between:
1. **Sort** and **Clear** buttons
2. **Export** and **Appspace** buttons (Appspace button is new)
3. **Appspace** and **Theme** buttons

CSS for separator:
```css
.header-separator {
  width: 1px;
  height: 24px;
  background: var(--border-color);
  margin: 0 4px;
  flex-shrink: 0;
}
```

#### Load Appspace Button
- Opens file picker for `.appspace`, `.csv`, or `.txt` files
- Label changes based on state:
  - No appspace loaded → "Load Appspace"
  - Appspace loaded → "Change Appspace"
- Position: Between Export and vertical separator (before Theme button)

#### Clear Appspace Button
- Only visible when appspace is loaded
- Clears loaded appspace data
- Returns to "Load Appspace" state after clearing

### 3.2 Tab Bar

#### Appspaces Tab
- Hidden until appspace file is loaded
- Display format: `Appspaces (X)` where X is total associations count
- Position: In "Data Model" section, after "Data Types" tab
- Has subtabs: "Objects (X)" and "Interactions (Y)"

**Subtab Selection Logic:**
- When Appspaces tab is clicked, show the previously selected subtab (stored in `state.appspaceSubTab`)
- If no previous selection exists, default to "Objects" subtab
- One of the two subtabs MUST always be selected/active when Appspaces tab is shown
- Store subtab selection in state on click for persistence across tab switches

### 3.3 Appspaces Tab Main Panel (Dedicated Tab)

When Appspaces tab is selected:

**Layout**:
- Hides left sidebar (tree panel)
- Shows content in main detail panel (NOT treeView)

**Subtabs**:
- Objects (X) - shows count of matching object classes
- Interactions (Y) - shows count of matching interaction classes
- Unknown (Z) - shows count of unmatched entries (red text)

**Table**:
| Class | App(s) |
|-------|-------|
| Hierarchical name in tree format | Unbulleted list |

#### Class Column Display
- Full hierarchical tree view (e.g., HLAobjectRoot.Customer.OrderItem)
- Parent levels: gray/different color
- Leaf level: accent color, clickable link
- Removes HLAobjectRoot. and HLAinteractionRoot. prefixes for display
- Clicking navigates to Objects/Interactions tab for that class

#### Apps Column Display
- Unbulleted text list format
- One app per line, no bullet points

#### Unknown Tab
- Shows entries that don't match any object or interaction class
- All entries displayed in red text
- No clickable links (no match found)

### 3.4 Class Information (In Object/Interaction Detail)

Add row to Class Information table in detail view:

| Attribute | Value |
|-----------|-------|
| Appspaces | MinefieldApp
              SensorApp (as non-bullet list if multiple) |

### 3.5 Back Button Navigation

Back button navigation must work across ALL tabs, including tabs with subtabs (DataTypes and Appspaces).

**History Stack Entry Format:**
```javascript
historyEntry = {
  tab: string,          // 'objects', 'interactions', 'datatypes', 'appspaces', etc.
  subTab: string|null,  // 'basic'|'simple'|... for datatypes, 'objects'|'interactions' for appspaces
  selected: object|null, // { name: string, type: string } - the selected item
  detail: string        // 'block' or 'none' - visibility of detail panel
}
```

**Behavior by Tab Type:**

1. **Tabs without subtabs** (Objects, Interactions, etc.):
   - Push history entry when navigating to item detail
   - Entry includes: `{ tab: 'objects', subTab: null, selected: {...}, detail: 'block' }`

2. **DataTypes tab** (has subtabs):
   - Push history entry when switching subtabs OR navigating to item detail
   - Entry includes current subtab: `{ tab: 'datatypes', subTab: 'basic', selected: {...}, detail: 'block' }`
   - When going back, restore both the tab AND the correct subtab

3. **Appspaces tab** (has subtabs):
   - Push history entry when switching subtabs OR clicking class link
   - Entry includes current subtab: `{ tab: 'appspaces', subTab: 'objects', selected: {...}, detail: 'block' }`
   - When going back, restore both the tab AND the correct subtab (objects/interactions)
   - Appspaces tab always has a subtab selected (defaults to 'objects')

**Back Button Click Logic:**
1. Pop last entry from `state.history`
2. If entry has `subTab` and tab is 'datatypes' or 'appspaces':
   - Restore main tab (add 'active' class)
   - Show/hide subtab bar as needed
   - Set `state.currentSubTab` to entry.subTab
   - Add 'active' class to correct subtab
3. Restore selected item and show detail view
4. Update back button visibility based on remaining history length

**Visibility:**
- Back button shows when `state.history.length > 0`
- Hidden when history is empty

## 4. State Properties

```javascript
state = {
  appspace: null | {
    fileName: string,
    entries: [{ className: string, apps: string[], matchedClass: string }],  // Matched to object classes
    interactions: [{ className: string, apps: string[], matchedClass: string }],  // Matched to interaction classes  
    unknown: [{ className: string, apps: string[] }]  // No match found
  },
  appspaceSubTab: 'objects' | 'interactions' | 'unknown'
}
```

**Classification Logic:**
- Parse ALL entries into a single array first
- For each entry:
  1. Check against object classes (right-side match) → Add to `entries`
  2. If no match, check against interaction classes → Add to `interactions`
  3. If still no match → Add to `unknown`

## 5. Storage
- Appspace data persists in IndexedDB
- Save on file load, change, and clear
- Restore on page refresh along with other state

## 6. Event Handlers

1. **Load Appspace** button click → Parse file, populate state.appspace
2. **Clear Appspace** button click → Clear state.appspace, hide tab
3. **Subtab** clicks → Switch between objects/interactions view
4. **Checkbox** toggle → Filter shown rows
5. **Class link** clicks → Navigate to object/interaction detail tab

## 7. Snackbar Notification

- **Trigger**: After successful appspace file load
- **Duration**: Auto-dismisses after 3-4 seconds
- **Message**: `Loaded X appspace associations from `

## 8. CSS Classes

| Class | Purpose |
|-------|---------|
| .appspace-controls | Container for controls |
| .appspace-table | Main table |
| .appspace-table th | Table header cells |
| .appspace-table td | Table body cells |
| .appspace-table tr.unmatched | Unmatched row styling |
| .appspace-link | Clickable class name link |
| .appspace-link:hover | Link hover state |
| .tree-part | Hierarchical name part |
| .tree-part.parent | Parent level (non-leaf) |
| .tree-part.leaf | Leaf level |
| .apps-list | App list container |
| .apps-list li | App list item (no bullets) |

## 9. Test Cases

### TC-001: Load Appspace File
- **Steps**: Click Load Appspace, select file
- **Expected**: Snackbar shows "Loaded X appspace associations from file.appspace"
- **Expected**: Button changes to "Change Appspace"
- **Expected**: Appspaces tab appears in tab bar

### TC-002: Clear Appspace File
- **Steps**: Click Clear Appspace
- **Expected**: Button changes to "Load Appspace"
- **Expected**: No appspace data displayed
- **Expected**: Appspaces tab hidden from tab bar

### TC-003: Replace Appspace File
- **Steps**: Load first file (3), load second file (5)
- **Expected**: Second completely replaces first
- **Expected**: Counts update in tab label and subtabs

### TC-004: Appspaces in Class Detail
- **Steps**: Load appspace, navigate to object class, view details
- **Expected**: "Appspaces" row shows assigned apps

### TC-005: No Appspace for Unmatched Class
- **Steps**: Load appspace, navigate to class without appspace entry
- **Expected**: No "Appspaces" row shown

### TC-006: Tab Navigation
- **Steps**: Click Appspaces tab
- **Expected**: Main panel shows appspace table (NOT sidebar)
- **Expected**: Click class link navigates to that class

### TC-007: Subtab Switching
- **Steps**: In Appspaces tab, click Interactions subtab
- **Expected**: Table updates to show interaction classes
- **Expected**: Interactions subtab gets 'active' class

### TC-008: Appspaces Tab Default Subtab
- **Steps**: Load appspace file, click Appspaces tab for first time
- **Expected**: Objects subtab is selected by default
- **Expected**: Objects subtab has 'active' class

### TC-009: Appspaces Tab Remember Subtab
- **Steps**: Click Appspaces tab, switch to Interactions subtab, switch to another tab, return to Appspaces
- **Expected**: Interactions subtab is still selected
- **Expected**: `state.appspaceSubTab` is 'interactions'

### TC-010: Back Button - Simple Tab
- **Steps**: Navigate to Objects tab, click a class to view detail, click Back
- **Expected**: Returns to Objects tab with tree view, detail panel hidden
- **Expected**: Back button visibility updates based on history

### TC-011: Back Button - DataTypes Tab with Subtabs
- **Steps**: Navigate to DataTypes tab (Basic subtab), click an item, click Back
- **Expected**: Returns to DataTypes tab with Basic subtab active
- **Expected**: Selected item detail is shown

### TC-012: Back Button - DataTypes Subtab Switch
- **Steps**: In DataTypes tab, switch to Simple subtab, click item, click Back
- **Expected**: Returns to DataTypes tab with Simple subtab active
- **Expected**: `state.currentSubTab` is 'simple'

### TC-013: Back Button - Appspaces Tab with Subtabs
- **Steps**: Load appspace, click Appspaces tab (Objects subtab), click a class link, click Back
- **Expected**: Returns to Appspaces tab with Objects subtab active
- **Expected**: Previous detail view or table is restored

### TC-014: Back Button - Appspaces Subtab Switch
- **Steps**: In Appspaces tab, switch to Interactions subtab, click a class, click Back
- **Expected**: Returns to Appspaces tab with Interactions subtab still active
- **Expected**: `state.appspaceSubTab` is 'interactions'

### TC-015: Vertical Separators Render
- **Steps**: Inspect header controls with appspace loaded
- **Expected**: Vertical separator visible between Sort and Clear buttons
- **Expected**: Vertical separator visible between Export and Appspace buttons
- **Expected**: Vertical separator visible between Appspace and Theme buttons
- **Expected**: Separators have correct CSS class `.header-separator`

### TC-016: Vertical Separators Not Present (Edge Cases)
- **Steps**: Check header without appspace loaded
- **Expected**: Separator between Export and Load Appspace (no Appspace button yet)
- **Expected**: Separator between Load Appspace and Theme when appspace not loaded

### TC-017: Unknown Tab Functionality
- **Steps**: Load appspace with unmatched entries, click Unknown subtab
- **Expected**: Shows only unmatched entries (red text)
- **Steps**: Click Objects/Interactions subtab
- **Expected**: Shows only matched entries with clickable links

### TC-018: Class Link Navigation from Appspaces
- **Steps**: In Appspaces tab (Objects), click a class link
- **Expected**: Navigates to Objects tab
- **Expected**: Correct class is selected and detail shown
- **Expected**: Back button can return to Appspaces tab

### TC-019: Snackbar Auto-Dismiss
- **Steps**: Load appspace file
- **Expected**: Snackbar appears with correct message
- **Expected**: Snackbar auto-dismisses after 3-4 seconds

### TC-020: State Persistence
- **Steps**: Load appspace, switch to Interactions subtab, refresh page
- **Expected**: Appspace data restored from IndexedDB
- **Expected**: Appspaces tab visible with Interactions subtab selected
- **Expected**: `state.appspaceSubTab` is 'interactions'

### TC-021: Appspaces Tab Hidden Without Data
- **Steps**: Clear appspace data, check tab bar
- **Expected**: Appspaces tab not visible in tab bar
- **Expected**: If Appspaces tab was active, switches to default tab

### TC-022: Back Button History Empty
- **Steps**: Load page, check back button
- **Expected**: Back button is hidden (no history)
- **Expected**: Clicking Back when no history does nothing

### TC-021: Appspace Buttons Visible When Loaded
- **Steps**: Load an appspace file successfully
- **Expected**: "Change Appspace" button is visible (display != 'none')
- **Expected**: "Clear Appspace" button is visible (display != 'none')
- **Expected**: `exportAppspaceSeparator` (between Export and Load Appspace) is visible (display != 'none')
- **Expected**: `appspaceSeparator` (between Clear Appspace and Theme) is visible (display != 'none')

### TC-022: Appspace Buttons Hidden When Cleared
- **Steps**: Load appspace, then click Clear Appspace
- **Expected**: "Load Appspace" button is visible (text changed back)
- **Expected**: "Clear Appspace" button is hidden (display = 'none')
- **Expected**: `exportAppspaceSeparator` is hidden (display = 'none')
- **Expected**: `appspaceSeparator` is hidden (display = 'none')

### TC-023: Load Appspace Button Click Handler Works
- **Steps**: Click "Load Appspace" button
- **Expected**: File picker dialog appears (input.click() is called)
- **Steps**: Select a valid .appspace file
- **Expected**: Appspace data is loaded, buttons update, Appspaces tab appears

### TC-024: Export/Appspace Separator Only Visible When Appspace Loaded
- **Steps**: Open page without appspace loaded
- **Expected**: `exportAppspaceSeparator` is hidden (no separator between Export and Load Appspace)
- **Steps**: Load an appspace file
- **Expected**: `exportAppspaceSeparator` becomes visible

### TC-025: Appspace/Theme Separator Only Visible When Appspace Loaded
- **Steps**: Open page without appspace loaded
- **Expected**: `appspaceSeparator` is hidden (no separator between Load Appspace and Theme)
- **Steps**: Load an appspace file
- **Expected**: `appspaceSeparator` becomes visible

### TC-026: FOM Class Parsing - Duplicate Simple Names
- **Steps**: Load `HLAstandardMIM.xml` (has classes with same simple name in different hierarchies)
- **Expected**: Object Classes tab shows ALL object classes (none missing)
- **Expected**: Interaction Classes tab shows ALL interaction classes (none missing)
- **Expected**: Classes with same simple name but different parents get correct full hierarchical names
- **Test**: Run `node --check /home/marchand/src/fom-viewer/src/main.js` after any parser changes
- **Test**: Rebuild with `npm run build` and verify no "buildFullName is not defined" error

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

### TC-030: Sort Button Persists Across Subtabs
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
