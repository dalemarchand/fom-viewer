# fom-viewer

A single-page HTML viewer for IEEE 1516 compliant Federation Object Model (FOM) files used in High-Level Architecture (HLA) simulations.

## Features

- **Single-file deployment**: One HTML file contains everything (CSS + JS inlined)
- **Vanilla JavaScript**: No frameworks - pure ES6+ JavaScript
- **Client-side only**: Runs entirely in the browser, no server required
- **IndexedDB persistence**: Caches FOM files and UI state in the browser
- **Light/Dark theme**: Toggle between themes with CSS custom properties
- **Multiple FOM support**: Load and merge multiple FOM files with dependency resolution
- **Appspace support**: Load custom appspace definitions for object/interaction classification
- **Export functionality**: Export merged FOM data

## Quick Start

### Prerequisites

- Node.js 14+ (for building)
- Chrome/Chromium (for testing)

### Build

```bash
# Install dependencies
npm install

# Build the project (creates fom-viewer.html)
npm run build

# Development build with external files (easier debugging)
npm run build:dev

# Build with source maps
npm run build:map
```

### Run

Open `fom-viewer.html` directly in a browser, or serve it from any web server.

## Architecture

### Source Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/main.js` | Main application logic, FOM parser, UI management | ~3508 |
| `src/styles.css` | CSS styles with light/dark theme support | ~532 |

### Core Components

#### FOMParser Class (`src/main.js:191-659`)
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

#### State Management (`src/main.js:12-32`)
Central `state` object manages application state including loaded files, merged FOM data, current tab/subtab, selection, sort order, navigation history, and appspace data.

#### UI Tabs
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

## Development Workflow

### Code Quality Requirements

#### Always Run Syntax Check After Edits
After making ANY edits to JavaScript files (`.js`), you MUST run a syntax check before building:

```bash
node --check src/main.js
```

This will catch syntax errors BEFORE building and deploying.

**IMPORTANT:** Never commit code that has syntax errors. Always run `node --check` before `npm run build`.

#### Build and Test Cycle

1. After editing `src/main.js` or `src/styles.css`, ALWAYS rebuild:
   ```bash
   npm run build
   ```

2. After building, test the output HTML for syntax errors by checking the built file at:
   - `fom-viewer.html`
   - `dist/fom-viewer.html`

### Linting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

ESLint configuration is in `.eslintrc.json`.

## Deployment

Since the application is a single HTML file:
1. Build the project: `npm run build`
2. Distribute `fom-viewer.html` - that's it!
3. Optionally use `dist/fom-viewer.html` for versioned deployments

The HTML file can be:
- Opened directly in a browser (file:// protocol)
- Served from any web server
- Embedded in documentation or portals

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
├── README.md          # This file
└── AGENTS.md          # AI agent instructions
```

## Key Dependencies

### Production
- None (vanilla JS + CSS)

### Development
- `eslint` (^8.57.1) - JavaScript linter

### Testing
- `puppeteer-core` - Browser automation
- Chrome/Chromium browser

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

## Theme Support

The application supports light and dark themes using CSS custom properties:

```javascript
// Light theme (default)
:root { --bg-primary: #f8fafc; ... }

// Dark theme
[data-theme="dark"] { --bg-primary: #0f172a; ... }
```

Theme can be toggled via the header theme toggle.

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

## Performance Considerations

- Large FOM files may take time to parse
- IndexedDB caching helps with repeat loads
- Consider pagination for very large FOMs (future enhancement)
- Tree view virtualization could help with 1000+ items (future enhancement)

## License

MIT
