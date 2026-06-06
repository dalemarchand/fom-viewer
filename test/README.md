# FOM Viewer Tests

Browser automation tests for FOM Viewer using Puppeteer.

## Prerequisites

- Node.js 14+
- Chrome/Chromium (installed by Puppeteer)

## Installation

```bash
cd test
npm install
```

## Running Tests

### Headless (default)
```bash
npm test
# or
node run.js
```

### Visible browser
```bash
npm run test:visible
# or
node run.js --visible
```

### Debug mode (slower, more verbose)
```bash
npm run test:debug
# or
node run.js --visible --debug
```

### Run specific test
```bash
node run.js --test=TabNavigation
node run.js --test=ItemSelection
node run.js --test=BackButton
```

### Custom timeout
```bash
node run.js --timeout=30000
```

### Combined test (builds first)
```bash
npm run test:combined
```

## Test Scenarios

| Test | Description | File Location |
|------|-------------|---------------|
| LoadPage | Page loads without JavaScript errors | `test/run.js:134` |
| TabNavigation | Main tabs switch correctly | `test/run.js:158` |
| AboutVersion_MetaTag | About dialog uses meta tag version | `test/run.js:192` |
| AboutVersion_MetaMissing | About dialog fallback when meta tag missing | `test/run.js:225` |
| AboutVersion_MetaPlaceholder | About dialog fallback when meta is placeholder | `test/run.js:252` |
| FileLoading | FOM files load and parse correctly | `test/run.js:284` |
| LoadAllFiles | All FOM files load successfully | `test/run.js:318` |
| ItemSelection | Clicking sidebar items shows details | `test/run.js:350` |
| DataTypeSelection | Data type items display correctly | `test/run.js:395` |
| CircularDependencyDetection | Circular dependency detection | `test/run.js:491` |
| BackButton | Back navigation restores state | `test/run.js:637` |
| BackButtonSubTabs | Back button works with sub-tabs | `test/run.js:676` |
| BackButtonEmbeddedLinks | Back button with embedded links | `test/run.js:720` |
| BackButtonIssuesEmptySubtab | Back button with empty Issues subtab | `test/run.js:766` |
| BackButtonFixes | Back button behavior with Issues subtabs | `test/back-button-fixes.test.js:19` |
| Search | Global search filters results | `test/run.js:896` |
| TreeFilter | Tree filtering functionality | `test/run.js:925` |
| SortToggle | Sort toggle on multiple tabs | `test/run.js:970` |
| DataTypeSubtabSorting | Data type subtab sorting | `test/run.js:1043` |
| Export | Export functionality | `test/run.js:1104` |
| SubTabNavigation | Sub-tabs (data types) switch correctly | `test/run.js:1140` |
| ValidationLifecycle | Validation lifecycle on load/remove/clear | `test/run.js:1175` |
| MergeClasses | MergeClasses attribute/parameter source tracking | `test/run.js:1264` |
| WelcomeStats | Welcome screen stats display | `test/welcome-stats.test.js:12` |
| IssueDetailPanelImprovements | Issue detail panel display improvements | `test/issue-detail-panel.test.js:9` |
| IssueHistoryPush | Issue history push on selection | `test/issue-history-push.test.js:9` |
| HistoryIssueAdversarial | Issue history adversarial tests | `test/history-issue-adversarial.test.js:9` |
| IssuesSubtabEmptyState | Issues subtab empty state messages | `test/issues-subtab-empty-state.test.js:10` |
| IssuesSubtabGuard | Issues subtab click guard | `test/issues-subtab-guard.test.js:10` |
| IssuesSubtabHistory | Issues subtab history recording | `test/issues-subtab-history.test.js:11` |
| IssuesCallOrderFix | Issues call order after file load | `test/issues-call-order-fix.test.js:10` |
| AppspaceFeature | Appspace load, display, persistence | `test/appspace.test.js:9` |

## Configuration

Edit `config.js` to modify:
- **Test timeout values**: Adjust `test.timeout` (default: 10000ms)
- **Test FOM files**: Modify `testFiles` array
- **Browser launch options**: Change `browser.executablePath`, `browser.args`
- **CSS selectors**: Update `selectors` object
- **Wait times**: Adjust `test.waitForSelector` (default: 2000ms)

### Configuration Options

```javascript
const config = {
  app: {
    htmlPath: path.resolve(__dirname, '../fom-viewer.html'),
    combinedHtmlPath: path.resolve(__dirname, '../dist/fom-viewer.html'),
    baseUrl: `file://${path.resolve(__dirname, '../fom-viewer.html')}`
  },
  test: {
    fomDir: path.resolve(__dirname, 'fom'),  // Test FOM files directory
    timeout: 10000,                          // Test timeout in ms
    waitForSelector: 2000                      // Wait timeout for selectors
  },
  browser: {
    headless: true,                           // Run without UI
    slowMo: 10,                               // Slow down operations by ms
    executablePath: '/usr/bin/google-chrome',    // Chrome/Chromium path
    args: ['--no-sandbox', '--disable-setuid-sandbox']  // Browser args
  },
  selectors: {
    tabs: '.tab-bar-scroll .tab',
    treeItem: '.tree-item',
    detailHeader: '.detail-header',
    detailBody: '.detail-body',
    backBtn: '#backBtn',
    globalSearch: '#globalSearch',
    fileInput: '#fileInput',
    clearBtn: '#clearBtn'
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
};
```

## Test Files

Place FOM XML files in `test/fom/` directory. These are loaded during tests.

### Required Test Files
- `HLAstandardMIM.xml` - Standard FOM
- `RPR-Foundation_v3.0.xml` - RPR Foundation
- `RPR-Physical_v3.0.xml` - RPR Physical
- `RPR-Enumerations_v3.0.xml` - RPR Enumerations
- `RPR-Base_v3.0.xml` - RPR Base
- `RPR-Aggregate_v3.0.xml` - RPR Aggregate
- `RPR-Communication_v3.0.xml` - RPR Communication
- `RPR-DER_v3.0.xml` - RPR Distributed Engagement Region

## Test Structure

### Test Runner (`run.js`)
The test runner (`run.js`) is ~1358 lines and contains:
- **Test functions**: Individual test cases (test_LoadPage, test_FileLoading, etc.)
- **Helper functions**: `launchBrowser()`, `openApp()`, `loadTestFomFile()`, `waitAndClick()`, etc.
- **Test runner**: `runAllTests()` orchestrates all tests
- **Screenshot capture**: Automatic on test failure

### Adding a New Test

1. Create a new test function following the pattern:
```javascript
async function test_YourTestName() {
  log('Testing: Your test description...');
  try {
    await openApp();
    // Your test logic here
    log('Your test passed', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_YourTestName_failed');
    logError('Your test failed', error);
    testsFailed++;
    return false;
  }
}
```

2. Add to the `tests` array in `runAllTests()`:
```javascript
const tests = [
  // ... existing tests
  { name: 'YourTestName', fn: test_YourTestName },
];
```

3. Run your test:
```bash
node run.js --test=YourTestName
```

## Debugging Failed Tests

### Screenshots
Failed tests automatically capture screenshots to `test/screenshots/`. Check these images to see the state of the application when the test failed.

### Console Output
The test runner captures and logs:
- Console messages from the page
- Page errors
- Test progress and results

### Debug Mode
Run with `--visible --debug` flags for:
- Visible browser to watch tests execute
- Slower execution for easier observation
- More verbose console output

```bash
node run.js --visible --debug
```

## CI/CD Integration

### Exit Codes
- `0`: All tests passed
- `1`: One or more tests failed

### Example CI Script
```bash
#!/bin/bash
cd test
npm install
npm test
```

## Notes

- Tests run against the built `fom-viewer.html` file
- The `test:combined` script builds the project before running tests
- Screenshots are only saved on test failure
- The test framework uses Puppeteer Core, which requires Chrome/Chromium to be installed
