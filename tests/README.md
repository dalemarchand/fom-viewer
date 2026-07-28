# Vitest Unit Test Suite

This folder houses the Vitest-driven unit and logic validation tests for the **fom-viewer** application.

## Directory Purpose
While the `test/` directory at the root houses browser-level E2E integration tests (using Puppeteer), this `tests/` directory focuses on verifying the core Javascript business logic, parser algorithms, and store states in isolation.

## Running Tests Locally
To execute the unit tests, run the following command at the root of the project:
```bash
npm run test:unit
```

To run the unit tests in interactive watch mode:
```bash
npm run test:unit:watch
```

## Testing Scope
The tests in this folder cover:
* **Appspace Logic**: Parsing, matching, and validating appspace configurations.
* **FOM Parsing**: Processing XML inputs and schema formats.
* **Merging**: Resolving class relationships and dependency overrides.
* **Storage**: IndexedDB caching operations.
* **Validation**: Conflict checks, cycle-detection, and data-type references.
