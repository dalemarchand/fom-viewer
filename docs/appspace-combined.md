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

**Controls**:
- Switch: "Hide unmatched items" - toggles showing rows where class not found in FOM
- Default: On (hide unmatched)

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
    objects: [{ className: string, apps: string[] }],
    interactions: [{ className: string, apps: string[] }]
  },
  appspaceHideUnmatched: boolean,  // default: true
  appspaceSubTab: 'objects' | 'interactions'
}
```

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

### TC-017: Hide Unmatched Toggle
- **Steps**: Load appspace with some unmatched classes, toggle "Hide unmatched items"
- **Expected**: Unmatched rows hidden when toggle is ON
- **Expected**: Unmatched rows shown when toggle is OFF
- **Expected**: Unmatched rows have `.unmatched` class

### TC-018: Class Link Navigation from Appspaces
- **Steps**: In Appspaces tab, click a class link
- **Expected**: Navigates to Objects/Interactions tab
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
