# TypeScript Migration Decision Record

## Decision
We decided to adopt **Option B: Hybrid TypeScript** as a minor update to version `v3.1.0`.

## Architecture Details

### Ambient Type Declarations
* Shared definitions are placed in `src/types.d.ts`. This acts as the canonical data schema reference for the codebase.
* All parsed entities (Object Classes, Interaction Classes, Data Types, Dimensions, Transportations, Notes, Switches, Tags, Time Config) are fully typed.

### Type Verification
* Main logic files (`src/lib/validation.js`, `src/lib/merge.js`, etc.) contain `// @ts-check` at the top of the file to trigger TypeScript parsing.
* A `tsconfig.json` at the root configures the TypeScript compiler with `checkJs: true` and `allowJs: true` to perform checks on standard `.js` and Svelte files.

### Development Workflow & CI Integration
* Future changes can be verified using the local task `npm run typecheck` which runs both `svelte-check` (for components) and `tsc --noEmit` (for JS logic).
* CI (`.github/workflows/ci.yml`) runs `npm run typecheck` automatically on every commit.

---

## Pros & Cons Metrics Considered

### Pros
* **Compile-Time Safety**: Catches schema mismatched property names inside validation and merge routines before runtime.
* **Autocomplete & Auto-Doc**: IDE autocomplete is immediately enabled inside Svelte 5 runes and logic components.
* **Low Setup Overhead**: Prevents renaming files and Svelte script conversions, which reduces agent friction.

### Cons
* **Generic Svelte Component cast complexity**: Occasional type assertion casts are needed in JSDoc comments.
