# Instructions for AI Agents

## Project Overview

**fom-viewer** is a single-page HTML viewer for IEEE 1516 compliant Federation Object Model (FOM) files. It allows users to load, view, and analyze FOM XML files used in High-Level Architecture (HLA) simulations.

### Key Characteristics
- **Single-file output**: The application is distributed as a single HTML file with inlined CSS and JavaScript
- **Vanilla JavaScript**: No frameworks - pure JS with modern ES6+ features
- **Client-side only**: Runs entirely in the browser, no server required
- **IndexedDB persistence**: Caches FOM files and UI state in the browser

---

## Architecture

### Source Files
| File | Purpose | Lines |
|------|---------|-------|
| `src/main.js` | Main application logic, FOM parser, UI management | ~3508 |
| `src/styles.css` | CSS styles with light/dark theme support | ~532 |

### Build System
The build process (`scripts/build.js`) creates a self-contained HTML file:

```bash
# Default: Inline CSS and JS into fom-viewer.html
npm run build

# Development: External CSS/JS files (easier debugging)
npm run build:dev  # or --external flag

# With source maps
npm run build:map  # or --sourcemap flag
```

**Build Outputs:**
- `fom-viewer.html` (root) - Production build with inlined assets
- `dist/fom-viewer.html` - Production build copy
- `dist/fom-viewer-dev.html` - Development build with external files

### Core Components

#### 1. FOMParser Class (`src/main.js:191-659`)
Parses IEEE 1516 FOM XML files and extracts:
- **Model Identification**: name, version, dependencies, metadata
- **Object Classes**: Hierarchical class structures with attributes
- **Interaction Classes**: Hierarchical interactions with parameters
- **Data Types**: basic, simple, array, fixed record, enumerated, variant
- **Dimensions**: Name and properties
- **Transportations**: Communication transport definitions
- **Notes**: Annotations and semantics
- **Switches**: Configuration switches
- **Tags**: Data type tags
- **Time**: Timestamp and lookahead settings

#### 2. State Management (`src/main.js:12-32`)
Central `state` object manages:
```javascript
const state = {
  files: [],              // Loaded FOM files
  mergedFOM: null,        // Merged FOM data
  currentTab: 'modules',   // Active tab
  currentSubTab: 'basic', // Active sub-tab (for data types)
  selectedItem: null,      // Currently selected item
  sortEnabled: 'asc',     // Sort order
  history: [],             // Back button history
  appspace: null,          // Appspace data
  appspaceSubTab: 'objects' // Appspace sub-tab
};
```

#### 3. UI Tabs
- **Modules**: FOM file modules
- **Objects**: Object classes
- **Interactions**: Interaction classes  
- **Data Types**: basic, simple, array, fixed, enum, variant (sub-tabs)
- **Dims**: Dimensions
- **Trans**: Transportations
- **Notes**: Notes
- **Switches**: Switches
- **Tags**: Tags
- **Time**: Time management
- **Appspaces**: Appspace objects, interactions, unknown (sub-tabs)

#### 4. Navigation & History
- Back button (`state.history`) maintains navigation history
- `goBack()` function restores previous state
- History is reset on: file load, appspace load/clear

---

## Development Workflow

### Code Quality Requirements

#### ALWAYS Run Syntax Check After Edits
After making ANY edits to JavaScript files (`.js`), you MUST run a syntax check before building:

```bash
node --check /home/marchand/src/fom-viewer/src/main.js
```

This will catch syntax errors BEFORE building and deploying.

**IMPORTANT:** Never commit code that has syntax errors. Always run `node --check` before `npm run build`.

#### Build and Test Cycle

1. After editing `src/main.js` or `src/styles.css`, ALWAYS rebuild:
   ```bash
   cd /home/marchand/src/fom-viewer && npm run build
   ```

2. After building, test the output HTML for syntax errors by checking the built file at:
   - `/home/marchand/src/fom-viewer/fom-viewer.html`
   - `/home/marchand/src/fom-viewer/dist/fom-viewer.html`

### Common Syntax Errors to Watch For

1. **Unterminated comments in state objects** - Be careful with `}` inside comments within JavaScript objects
2. **Missing commas** between object properties
3. **Duplicate code blocks** - When editing functions, ensure you don't leave duplicate code from previous versions
4. **Unmatched braces** - Ensure all `{` and `}` are properly paired
5. **Method vs Function** - When adding a function that needs to be called from multiple methods in a class, add it as a method of the class, not as a standalone function

### Debugging Syntax Errors

If you get a syntax error like:
```
SyntaxError: Unexpected identifier 'xxx' (at file:line:X)
```

Steps to debug:
1. Check the line number mentioned in the error
2. Look for missing commas, unterminated comments, or misplaced code blocks
3. Run `node --check` on the source file to verify the fix
4. Rebuild and test again

---

## Important Notes

- **This is a GitHub repository (not GitLab)**
- The HTML file (`fom-viewer.html`) is AUTO-GENERATED from `src/main.js` during build
- **NEVER edit `fom-viewer.html` directly** - always edit `src/main.js` and rebuild
- Test cases are documented in `docs/appspace-combined.md`
- All appspace features should be tested according to the test cases in the documentation

---

## Navigation Requirements

### Back Button Behavior
The back button (`state.history`) must be reset when:
- FOM files are loaded (`loadFiles()`)
- Appspace file is loaded from file (`loadAppspaceFromFile()`)
- Appspace is loaded from IndexedDB (`loadAppspaceFromStorage()`)
- Appspace is cleared (`clearAppspaceFromStorage()`)
- FOM files are cleared (clear button handler)

### Selection Visibility
Any user input that changes the view must result in:
- A selection in the left pane (if visible)
- An update to the central view (detail panel)

Back button navigation must result in:
- Previous selections restored
- Previous views restored
- Selected item scrolled into view if not visible

### scrollIntoView Usage
- Use `scrollIntoView({ block: 'nearest' })` to make selections visible
- Apply after adding 'selected' class to tree items
- Required in these functions:
  - `goBack()` - after restoring selection
  - `updateUI()` - after selecting items in all tabs
  - `showDataType()` - after selecting data type items
  - `showDetail()` - after selecting detail items

---

## Testing

### Test Framework
The project uses **Puppeteer** for browser automation testing.

### Running Tests

```bash
# Install test dependencies
cd test && npm install

# Run all tests (headless)
cd test && npm test
# or
cd test && node run.js

# Run with visible browser
cd test && npm run test:visible
# or
cd test && node run.js --visible

# Debug mode (slower, more verbose)
cd test && npm run test:debug
# or
cd test && node run.js --visible --debug

# Run specific test
node run.js --test=TabNavigation
node run.js --test=ItemSelection

# Custom timeout
node run.js --timeout=30000

# Run combined test (builds first)
npm run test:combined
```

### Test Scenarios

| Test | Description | File |
|------|-------------|------|
| LoadPage | Page loads without JavaScript errors | `test/run.js:109` |
| FileLoading | FOM files load and parse correctly | `test/run.js:166` |
| LoadAllFiles | All FOM files load successfully | `test/run.js:200` |
| TabNavigation | Main tabs switch correctly | `test/run.js:133` |
| SubTabNavigation | Sub-tabs (data types) switch correctly | `test/run.js:746` |
| ItemSelection | Clicking sidebar items shows details | `test/run.js:232` |
| DataTypeSelection | Data type items display correctly | `test/run.js:277` |
| BackButton | Back navigation restores state | `test/run.js:373` |
| BackButtonSubTabs | Back button works with sub-tabs | `test/run.js:412` |
| BackButtonEmbeddedLinks | Back button with embedded links | `test/run.js:456` |
| Search | Global search filters results | `test/run.js:502` |
| TreeFilter | Tree filtering functionality | `test/run.js:531` |
| SortToggle | Sort toggle on multiple tabs | `test/run.js:576` |
| DataTypeSubtabSorting | Data type subtab sorting | `test/run.js:649` |
| Export | Export functionality | `test/run.js:710` |

### Test Configuration (`test/config.js`)

```javascript
{
  app: {
    htmlPath: '../fom-viewer.html',
    combinedHtmlPath: '../dist/fom-viewer.html'
  },
  test: {
    fomDir: 'fom',  // Test FOM files directory
    timeout: 10000,    // Test timeout in ms
    waitForSelector: 2000
  },
  browser: {
    headless: true,
    slowMo: 10,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  testFiles: [
    'HLAstandardMIM.xml',
    'RPR-Foundation_v3.0.xml',
    'RPR-Physical_v3.0.xml',
    'RPR-Enumerations_v3.0.xml',
    'RPR-Base_v3.0.xml',
    'RPR-Aggregate_v3.0.xml',
    'RPR-Communication_v3.0.xml',
    'RPR-DER_v3.0.xml'
  ]
}
```

### Test FOM Files
Place FOM XML files in `test/fom/` directory. These are loaded during tests.

Required test files (from config):
- `HLAstandardMIM.xml` - Standard FOM
- `RPR-Foundation_v3.0.xml` - RPR Foundation
- `RPR-Physical_v3.0.xml` - RPR Physical
- `RPR-Enumerations_v3.0.xml` - RPR Enumerations
- `RPR-Base_v3.0.xml` - RPR Base
- `RPR-Aggregate_v3.0.xml` - RPR Aggregate
- `RPR-Communication_v3.0.xml` - RPR Communication
- `RPR-DER_v3.0.xml` - RPR Distributed Engagement Region

---

## Testing After Fixes

After making ANY fix:
1. Run `node --check /home/marchand/src/fom-viewer/src/main.js` to verify syntax
2. Run `cd /home/marchand/src/fom-viewer && npm run build` to rebuild
3. Test in browser with Ctrl+F5 (hard refresh) to clear cache
4. Verify the specific feature that was fixed works correctly

---

## Testing Parser Changes

When modifying `FOMParser` methods (`parseObjectClasses`, `parseInteractionClasses`, `buildFullName`):

1. ALWAYS run `node --check /home/marchand/src/fom-viewer/src/main.js` after edits
2. Rebuild with `npm run build`
3. Test loading FOM files (including `HLAstandardMIM.xml`)
4. Verify Object Classes tab shows ALL classes (none missing)
5. Verify Interaction Classes tab shows ALL classes (none missing)
6. Check browser console for "buildFullName is not defined" or similar errors

---

## Testing Navigation

Test navigation across:
- **ALL tabs**: modules, objects, interactions, dims, trans, notes, switches, tags, time
- **ALL data types subtabs**: basic, simple, array, fixed, enum, variant
- **ALL appspaces subtabs**: objects, interactions, unknown
- Verify back button works correctly in all cases

---

## File Structure

```
fom-viewer/
├── src/
│   ├── main.js          # Main application logic (~3508 lines)
│   └── styles.css       # CSS styles (~532 lines)
├── scripts/
│   └── build.js        # Build script
├── test/
│   ├── run.js          # Test runner (~838 lines)
│   ├── config.js       # Test configuration
│   ├── README.md       # Test documentation
│   ├── fom/           # Test FOM files
│   └── screenshots/   # Test failure screenshots
├── dist/               # Build output directory
│   ├── fom-viewer.html
│   └── fom-viewer-dev.html
├── docs/
│   └── appspace-combined.md  # Appspace test documentation
├── fom-viewer.html    # Root build output (auto-generated)
├── package.json        # Node.js package config
├── README.md          # Project README
└── AGENTS.md          # This file
```

---

## Key Dependencies

### Production
- None (vanilla JS + CSS)

### Development
- `eslint` (^8.57.1) - JavaScript linter

### Testing
- `puppeteer-core` - Browser automation
- Chrome/Chromium browser

---

## Appspace Feature

Appspaces allow loading custom FOM appspace definitions that classify objects and interactions.

### Appspace State Structure
```javascript
{
  fileName: string,
  entries: [{ className: string, apps: [] }],
  interactions: [{ className: string, apps: [], matchedClass: string }],
  unknown: [{ className: string, apps: [] }]
}
```

### Appspace Tabs
- **Objects**: Classified objects
- **Interactions**: Classified interactions with matched classes
- **Unknown**: Unclassified items

---

## Theme Support

The application supports light and dark themes using CSS custom properties:

```javascript
// Light theme (default)
:root { --bg-primary: #f8fafc; ... }

// Dark theme
[data-theme="dark"] { --bg-primary: #0f172a; ... }
```

Theme can be toggled via the header theme toggle.

---

## Linting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

ESLint configuration is in `.eslintrc.json`.

---

## Deployment

Since the application is a single HTML file:
1. Build the project: `npm run build`
2. Distribute `fom-viewer.html` - that's it!
3. Optionally use `dist/fom-viewer.html` for versioned deployments

The HTML file can be:
- Opened directly in a browser (file:// protocol)
- Served from any web server
- Embedded in documentation or portals

---

## Common Tasks

### Adding a New Feature
1. Edit `src/main.js`
2. Run `node --check src/main.js` to verify syntax
3. Run `npm run build` to build
4. Test manually in browser
5. Run automated tests: `cd test && npm test`
6. Commit changes (never commit `fom-viewer.html` changes - it's auto-generated)

### Fixing a Bug
1. Identify the issue in `src/main.js`
2. Make the fix
3. Run `node --check src/main.js`
4. Run `npm run build`
5. Test the specific feature
6. Run full test suite
7. Commit

### Adding a New Test
1. Edit `test/run.js`
2. Add test function following the existing pattern
3. Add to `tests` array in `runAllTests()`
4. Test your new test: `node run.js --test=YourTestName`
5. Commit

---

## Swarm Integration

This project uses the OpenCode Swarm multi-agent system for development tasks.

### Swarm Files
- `.swarm/plan.md` - Implementation plan
- `.swarm/context.md` - Project context and decisions
- `.swarm/evidence/` - QA gate evidence (reviews, tests)

### Swarm Commands
```bash
# Show swarm status
/swarm status

# Show current plan
/swarm plan

# Run full-auto mode
/swarm full-auto on

# Check evidence
/swarm evidence
```

---

## Troubleshooting

### Build Fails
- Check `src/main.js` syntax: `node --check src/main.js`
- Ensure all dependencies installed: `npm install`
- Check build script output for errors

### Tests Fail
- Check Puppeteer can find Chrome: verify `executablePath` in `test/config.js`
- Check test FOM files exist in `test/fom/`
- View screenshots in `test/screenshots/` for failed tests
- Run with `--visible --debug` flags for debugging

### FOM Files Don't Load
- Check browser console for errors
- Verify XML is valid (well-formed)
- Check FOM parser for the specific element type
- Test with known-good file like `HLAstandardMIM.xml`

---

## Performance Considerations

- Large FOM files may take time to parse
- IndexedDB caching helps with repeat loads
- Consider pagination for very large FOMs (future enhancement)
- Tree view virtualization could help with 1000+ items (future enhancement)
