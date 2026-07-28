# TypeScript vs JSDoc for FOM Viewer v2.0

## Context

- You're an occasional TypeScript user (not daily)
- The app must ship as a **single HTML file** (no import maps, no external deps at runtime)
- Existing codebase: 4790-line vanilla JS monolith
- Target: Svelte 5 with ~53 components/modules
- Team: you (potentially + AI agents)

---

## Option 1: Full TypeScript (`.ts`, `.svelte` with `<script lang="ts">`)

### How It Works

```
src/
├── components/
│   ├── TreeView.svelte       <script lang="ts">
│   ├── DetailPanel.svelte    <script lang="ts">
│   └── ...
├── stores/
│   ├── fomStore.svelte.ts    (Svelte 5 runes with TS)
│   └── ...
├── lib/
│   ├── FOMParser/
│   │   ├── index.ts
│   │   └── parseObjectClasses.ts
│   └── merge.ts
├── main.ts
└── vite.config.ts
```

Vite + `@sveltejs/vite-plugin-svelte` handles TS natively. The compiled output is still vanilla JS — TS is stripped during compilation. **No runtime overhead in the single-file output.**

### Pros

| Factor | Detail |
|--------|--------|
| **Compile-time safety** | `sillyTypo` on a variable → build fails. Catches renaming mistakes, wrong argument order, null checks |
| **Editor autocomplete** | Property suggestions, "go to definition", refactoring (rename symbol across files) works flawlessly |
| **Svelte 5 first-class** | Svelte 5's runes (`$state`, `$derived`, `$effect`) have full TS support. The Svelte compiler understands TS natively |
| **Self-documenting** | `parseObjectClasses(doc: Document): ObjectClass[]` tells you everything. No need to read the function body |
| **Refactoring confidence** | Rename a field in `ObjectClass` → all consumers update automatically. In JS, you hunt for string references |
| **AI agent compatibility** | Your swarm agents get better autocomplete context in TS files. Fewer "assumed wrong type" bugs |
| **Gradual adoption** | You can add `any` liberally and tighten later. Not all-or-nothing |

### Cons

| Factor | Detail |
|--------|--------|
| **Build step required** | TS compiles to JS. Vite does this transparently, but you can't edit `.ts` and run without the build step. Development mode (Vite HMR) handles this. For the single-file output, Vite compiles TS → JS → inlines into HTML. No extra user-facing complexity — it's the same `npm run build` |
| **Learning curve** | You need to learn: interfaces for FOM data shapes, generics for tree/node types, `satisfies`, discriminated unions for issue types. You said you're an occasional TS user — expect some friction |
| **Svelte 5 TS gotchas** | Svelte 5's `$state()` uses TS `$$Generic` for component generics — this is cutting-edge TS. Stack overflow answers are sparse (2026-era) |
| **Type definition maintenance** | You'll maintain interfaces for: `ObjectClass`, `InteractionClass`, `BasicDataType`, `SimpleDataType`, `ArrayDataType`, `FixedRecordDataType`, `EnumDataType`, `VariantDataType`, `Dimension`, `Transportation`, `Note`, `Switch`, `Tag`, `TimeConfig`, `Issue`, `AppspaceEntry`, `HistoryEntry`, `MergeResult`... ~20+ interfaces. These are documentation you'd write anyway, but enforced |
| **Tooling setup** | Vite handles it, but you need `tsconfig.json`, `@tsconfig/svelte`, and resolve occasional type errors from third-party libs (puppeteer types) |
| **File rename overhead** | `.js` → `.ts` for lib files, `<script>` → `<script lang="ts">` for Svelte files |
| **AI agent friction** | Your swarm agents currently write JS. If they need to write TS interfaces first, then implementations, it's an extra step. The output is more correct but slower to produce |

### Estimated Overhead

For a 53-component/10-module project:
- Writing interfaces: ~1-2 hours upfront + ~30 min per new component
- Debugging type errors: ~10-20% of development time initially, decreasing over time
- Build failures from type errors: occasional, but they prevent runtime bugs you'd otherwise spend hours debugging

---

## Option 2: JSDoc with `// @ts-check` (Plain `.js` files)

### How It Works

```javascript
// @ts-check

/** @param {Document} doc @returns {ObjectClass[]} */
export function parseObjectClasses(doc) {
  // ... plain JS ...
  /** @type {ObjectClass} */
  const cls = { name: '', attributes: [] };
  return items;
}
```

Vite just passes the JS through. Type checking happens in your editor only (or optionally via `tsc --noEmit`). **Zero build changes.**

### Pros

| Factor | Detail |
|--------|--------|
| **Zero config** | No `tsconfig.json`, no `lang="ts"`, no type installation. Open `main.js` and it works |
| **Gradual, optional** | Start with `// @ts-check` on one file, leave others unchecked. Tighten over months |
| **Same output path** | Vite handles JS natively. No mental model change for "what gets compiled" |
| **Lower learning curve** | You type JSDoc comments as you go. VS Code still provides autocomplete from JSDoc. You don't need to learn TS syntax — just `@param`, `@returns`, `@type` |
| **Simpler AI agent prompts** | Agents write plain JS, you add JSDoc later. Fewer "type error" loops |
| **Svelte 5 runes work** | Svelte 5's `$state()` works in JS files. No issues |
| **Puppeteer tests unchanged** | Puppeteer test files stay `.js`. No mixed TS/JS config in test dir |

### Cons

| Factor | Detail |
|--------|--------|
| **No real type safety** | JSDoc is a comment. `tsc --noEmit` catches some issues, but JSDoc type annotations are easily wrong or stale. There's nothing enforcing that `@returns {string}` actually returns a string |
| **Verbose type annotations** | `@param {import('./types').ObjectClass} cls` vs TS: `cls: ObjectClass`. JSDoc for complex types is ugly |
| **No type imports** | You can't `import { ObjectClass }` — you use `@typedef` or `@param {import('./file').Type}` which is fragile |
| **No discriminated unions** | You can type `@param {('asc'|'desc'|false)} sortDir` approximately but it's clunky. TS's `sortDir: 'asc' | 'desc' | false` is far cleaner |
| **Refactoring is guessing** | Rename a property in a `@typedef` → your editor might update it, might not. No compiler telling you what broke |
| **No generic enforcement** | `@template T` in JSDoc is painful. TS generics are natural |
| **Easier to skip** | Without enforcement, teams (and AI agents) tend to skip JSDoc. The stricture of TS forces the documentation |

### JSDoc Verbosity Comparison

| Scenario | TypeScript | JSDoc |
|----------|-----------|-------|
| Function with typed params | `function merge(a: Doc, b: Doc): Doc` | `/** @param {Document} a @param {Document} b @returns {Document} */` |
| Array of objects | `items: ObjectClass[]` | `@param {ObjectClass[]} items` |
| Union type | `sortDir: 'asc'\|'desc'\|false` | `@param {('asc'\|'desc'\|false)} sortDir` |
| Nullable | `name: string \| null` | `@param {string\|null} name` |
| Import type | `import { Issue } from './types'` | `@param {import('./types').Issue} issue` |

---

## Option 3: Hybrid (Recommended Middle Ground)

### What It Looks Like

```
src/
├── types.d.ts              ← Shared type declarations (pure TS ambient)
├── components/*.svelte     ← Plain JS (<script>, no lang="ts")
├── lib/*.js                ← Plain JS with JSDoc type references
├── main.js                 ← No types, minimal
└── tsconfig.json           ← { "checkJs": true, "allowJs": true }
```

- Write **one** `types.d.ts` file with all your interfaces (ObjectClass, Issue, etc.)
- Svelte components use `// @ts-check` — reference types via JSDoc comments
- Lib modules use `// @ts-check` — import types from `types.d.ts`
- `npm run typecheck` (or your editor) reports real errors
- No `.ts` files, no `lang="ts"`, no rename pain

### Pros & Cons

| Factor | This Hybrid |
|--------|-------------|
| Setup | One `types.d.ts` + `tsconfig.json` with `checkJs: true`. ~30 minutes |
| Type safety | Better than bare JSDoc (types are real `.d.ts` declarations, not `@typedef` in comments) |
| Syntax | Components stay plain JS. No `lang="ts"`. Type annotations stay in comments |
| Refactoring | Rename in `types.d.ts` → editor highlights all JSDoc references. Not perfect but workable |
| Learning | You write one `.d.ts` file with all types. The rest is JSDoc comments |
| AI agents | Agents write JS, reference `types.d.ts`. The type file anchors their understanding |
| Svelte 5 | Works fine. `$state()` in JS, types via JSDoc |
| Test files | Puppeteer tests unchanged |

---

## Recommendation

| If you... | Choose |
|-----------|--------|
| Want guardrails and are willing to learn | **Full TypeScript** — it's the same cost as the hybrid but with better tooling. The Svelte 5 learning curve will dominate anyway; adding TS on top is marginal |
| Value simplicity and want to move fast now | **Hybrid (types.d.ts + JSDoc)** — you get type documentation without the syntax tax. You can always migrate to full TS later by renaming files and adding `lang="ts"` |
| Hate any extra config complexity | **JSDoc only** — minimal overhead, minimal benefit |

**My honest take given two pieces of information:**
1. You're an occasional TS user
2. This is primarily you + AI agents maintaining the code

→ **Go Hybrid (Option 3).** Here's why:

- The AI agents currently write JS. JSDoc with `@param`/`@returns` is the lowest-friction way to give them type hints without retraining them on TS.
- You'll document the 20+ FOM data types once in `types.d.ts`. That file becomes the canonical reference for the entire project. Agents can read it for context.
- If you later decide you want full TS, the migration is: add `lang="ts"` to Svelte files, rename `.js` to `.ts`, fix type errors. The JSDoc types guide the migration.
- The single-file output is unaffected either way — Vite strips types during compilation.

But the final say is yours. Want to go a specific direction?
