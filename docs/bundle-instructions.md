# FOM Viewer Bundle & Branding Guide

This guide explains how to package the **FOM Viewer** with pre-loaded IEEE 1516 FOM files and appspace classification definitions, customize the application name/branding, and distribute it as a single self-contained HTML file.

---

## 1. Overview of Operational Modes

When creating a preloaded bundle, you can configure it to operate in one of two modes:

### Strict Mode (`strict`)
* **Use Case**: Formal distributions or official releases where users must explore only a predefined set of simulation models.
* **Behavior**:
  - The viewer is strictly read-only.
  - Hides and disables all file loading widgets, file inputs, drag-and-drop dropzones, and workspace clear actions.
  - Hides the ability to load, modify, or clear appspace definitions.
  - Hides "Remove Module" buttons from individual file views.
  - Displays a `🔒 Read-Only Bundle` status badge in the header.

### Flexible Mode (`flexible`)
* **Use Case**: Staging, testing, or collaborative environments where users start with a base set of models but can add local files or custom appspaces.
* **Behavior**:
  - The viewer opens with the preloaded models and appspace pre-cached in IndexedDB.
  - Users are allowed to load additional files, delete files, or load a different appspace.
  - **Modification Tracking**: The viewer compares the files currently in the workspace (filenames and XML content hashes) with the original bundle list.
  - If a change is detected, a `✏️ Flexible Bundle (Modified)` status badge is shown in the header alongside an inline `[Restore Defaults]` button.
  - Clicking **Restore Defaults** prompts the user and reloads the original bundle workspace.

---

## 2. Step-by-Step Guide to Creating a Bundle

Follow these steps to package and brand your custom viewer:

### Step 1: Organize Your Bundle Assets
Create a local folder (e.g. `my-delivery/`) and place the following inside:
- One or more `.xml` FOM/MIM files.
- (Optional) One `.appspace` or `.csv` classification file. Both formats are supported:
  - **`.appspace` files**: Pipe-delimited format (e.g. `ClassName | App1, App2`).
  - **`.csv` files**: Comma-separated format with an optional header line (e.g. `Class,Apps\nClassName,App1,App2` or `ClassName,"App1, App2"`).
- (Optional) A custom badge image (PNG, SVG, JPG, JPEG, or GIF). If placed in the target directory, it will be automatically detected and processed.

### Step 2: Compile the Bundle Configuration
Run the `prepare-bundle.cjs` script to automatically compile your folder contents and branding options into `src/custom-config.json`.

```bash
node scripts/prepare-bundle.cjs --dir /path/to/my-delivery --mode flexible --title "Joe's FOM Viewer" --badge-text "Release 1.0" --badge-color "#ff4757"
```

#### CLI Options:
* `--dir <path>` *(Required)*: Path to the directory containing your FOM XML files and optional appspace/image assets.
* `--mode <strict|flexible>` *(Default: `flexible`)*: Selects the operational mode of the bundle.
* `--title <string>` *(Default: `"FOM Viewer"`)*: The custom application title displayed in the browser tab and header.
* `--badge-text <string>`: Text content for the branding badge.
* `--badge-color <color>` *(Default: `"rgba(255,255,255,0.2)"`)*: Branding badge background color (CSS value, e.g. HSL or Hex).
* `--badge-text-color <color>` *(Default: `"white"`)*: Branding badge text color.
* `--badge-image <path>`: Local path to an image file (e.g. logo) to use as the badge instead of text. If not specified, the script will attempt to automatically detect a common image format (PNG, SVG, JPG, JPEG, GIF) inside the bundle directory/ZIP and use it. The script automatically encodes the image to a Base64 data URL.

*Note: The script automatically calculates content hashes for XML files and generates a unique `bundleId` based on timestamps to handle client cache invalidation.*

### Step 3: Build the Application
Re-build the project to inline the configuration, CSS, and JS assets into a single HTML file:

```bash
npm run build
```

This compiles your customized bundle into the root-level `fom-viewer.html` and the `dist/fom-viewer.html` output files.

### Step 4: Distribute the Viewer
Distribute the generated `fom-viewer.html` file to your team or organization. Users can open it directly in any modern browser (`file://` protocol) or host it on a static web server.

---

## 3. Client Storage & Cache Invalidation

To ensure fast load times, the viewer caches FOM files and state in browser IndexedDB storage.

When a user opens a new bundle version:
1. The viewer reads the compiled `bundleId` from the config.
2. It compares it with the `__bundleId__` key in the browser's IndexedDB.
3. If they differ (or no ID is stored), the browser automatically clears out old data and overwrites IndexedDB with the new preloaded files, appspace, and default UI state.
