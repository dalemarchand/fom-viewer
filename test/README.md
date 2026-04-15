# FOM Viewer Tests

Browser automation tests for FOM Viewer using Puppeteer.

## Install

```bash
cd test
npm install
```

## Run Tests

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
```

### Custom timeout
```bash
node run.js --timeout=30000
```

## Test Scenarios

| Test | Description |
|------|------------|
| LoadPage | Page loads without JavaScript errors |
| FileLoading | FOM files load and parse correctly |
| TabNavigation | Main tabs switch correctly |
| SubTabNavigation | Sub-tabs (data types) switch correctly |
| ItemSelection | Clicking sidebar items shows details |
| BackButton | Back navigation restores state |
| Search | Global search filters results |

## Configuration

Edit `config.js` to modify:
- Test timeout values
- Test FOM files
- Browser launch options
- CSS selectors

## Test Files

Place FOM XML files in `test/fom/` directory. These are loaded during tests.

## Requirements

- Node.js 14+
- Chrome/Chromium (installed by Puppeteer)