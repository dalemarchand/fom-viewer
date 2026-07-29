# Instructions for AI Agents

## 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

## 5. Documentation Maintenance
**Keep root documentation clean, actionable, and current.**
* Only active, current user-facing guides, bundle instructions, and backlog items should remain in the root of the `docs/` folder.
* Completed plans, audits, specs, migration logs, decision records, and retired architectural design documents must be moved into the `docs/historical/` subfolder as soon as they are completed or made obsolete.
* When implementing requested features, check the backlog in `docs/future-enhancements.md` — remove or update any resolved entries, and document any newly deferred feature designs or constraints.
* Always check for orphan or outdated references in root documents when moving files.

---

## Project Overview
**fom-viewer** is a single-page HTML viewer for IEEE 1516 Federation Object Model (FOM) files.

### Key Characteristics
- **Svelte 5 runes-based architecture**: Reactive stores and components compiled to DOM updates.
- **Client-side only**: Runs entirely in the browser, no server required.
- **Single-file distribution**: Compiles to `fom-viewer.html` at the root.
- **Committed HTML size limit**: The root `fom-viewer.html` committed to git must be a non-bundled build (less than 1.5 MB).

---

## Architecture & Codebase Layout

### Source Files
* `src/main.js` - Application entry point containing window-level harness bindings.
* `src/lib/` - Svelte components and type renderers.
* `src/lib/stores/` - Runes state stores (`fomStore`, `uiStore`, `historyStore`, etc.).
* `src/lib/FOM-Parser/` - FOM XML parsing modules.

### Harness Bindings Warning
> [!IMPORTANT]
> The test harness bindings defined at the bottom of `src/main.js` (e.g., `window.parseAppspaceFile`, `window.state`, etc.) are critical for Puppeteer E2E tests. Never rename or delete these mappings.

---

## Development & Verification Workflow

Agents must execute the following workflow sequentially after any code modifications:

### Step 1: Syntax Check
Always verify syntax of JavaScript entry points:
```bash
node --check src/main.js
```

### Step 2: Type Check
Verify JSDoc type validation across core business logic:
```bash
npm run typecheck
```

### Step 3: Unit Verification
Run the Vitest logic test suite:
```bash
npm run test:unit
```

### Step 4: Rebuild HTML
Compile assets into the single HTML output:
```bash
npm run build
```

### Step 5: E2E Integration Verification
> [!IMPORTANT]
> Always execute the E2E verification test suite (`npm test`) immediately after rebuilding the app (`npm run build`) to ensure the compiled standalone HTML runs correctly.
Run browser automation scenarios using Puppeteer:
```bash
npm test
```

### Step 6: Commit and CI Rules
> [!WARNING]
> Never append `[skip ci]` or bypass CI test suite execution in any commit message or pull request description unless explicitly granted permission by the user.
