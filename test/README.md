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
The test runner (`run.js`) is ~838 lines and contains:
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
