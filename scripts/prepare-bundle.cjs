const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function printUsage() {
  console.log(`
Usage: node scripts/prepare-bundle.cjs [options]

Options:
  --dir <path>              Path to directory containing FOM files and appspaces
  --zip <path>              Path to a zip file containing FOM files and appspaces
  --mode <strict|flexible>  Bundle preloading mode (default: flexible)
  --title <string>          Custom title for the viewer
  --badge-text <string>     Custom badge text (displayed in the header)
  --badge-color <color>     Custom badge background color (hex or CSS color)
  --badge-text-color <color> Custom badge text color (hex or CSS color)
  --badge-image <path>      Path to local image/SVG to inline as data URL
  --clear                   Clear custom configuration and restore defaults
`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir' && args[i+1]) {
    options.dir = args[++i];
  } else if (args[i] === '--zip' && args[i+1]) {
    options.zip = args[++i];
  } else if (args[i] === '--mode' && args[i+1]) {
    options.mode = args[++i];
  } else if (args[i] === '--title' && args[i+1]) {
    options.title = args[++i];
  } else if (args[i] === '--badge-text' && args[i+1]) {
    options.badgeText = args[++i];
  } else if (args[i] === '--badge-color' && args[i+1]) {
    options.badgeColor = args[++i];
  } else if (args[i] === '--badge-text-color' && args[i+1]) {
    options.badgeTextColor = args[++i];
  } else if (args[i] === '--badge-image' && args[i+1]) {
    options.badgeImage = args[++i];
  } else if (args[i] === '--clear') {
    options.clear = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    printUsage();
    process.exit(0);
  }
}

// Helper to scan directory recursively
function scanDir(dir, filesList = []) {
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(res, filesList);
    } else {
      filesList.push(res);
    }
  }
  return filesList;
}

// Fast synchronous hash function (must match browser implementation)
function getHashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

if (options.clear) {
  const defaultConfig = {
    title: "",
    badgeText: "",
    badgeColor: "",
    badgeTextColor: "",
    badgeImage: "",
    preloadedFiles: [],
    preloadedAppspace: null,
    bundleId: "",
    mode: "flexible"
  };
  fs.writeFileSync(path.join(__dirname, '../src/custom-config.json'), JSON.stringify(defaultConfig, null, 2));
  console.log("Custom bundle configuration cleared.");
  process.exit(0);
}

const config = {
  title: options.title !== undefined ? options.title : "",
  badgeText: options.badgeText !== undefined ? options.badgeText : "",
  badgeColor: options.badgeColor !== undefined ? options.badgeColor : "",
  badgeTextColor: options.badgeTextColor !== undefined ? options.badgeTextColor : "",
  badgeImage: "",
  preloadedFiles: [],
  preloadedAppspace: null,
  bundleId: "",
  mode: options.mode === 'strict' ? 'strict' : 'flexible'
};

let sourceDir = null;
let tempDir = null;

if (options.zip) {
  if (!fs.existsSync(options.zip)) {
    console.error(`Error: Zip file does not exist: ${options.zip}`);
    process.exit(1);
  }
  tempDir = path.join(__dirname, '../tmp-bundle-extract');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });
  console.log(`Extracting zip archive ${options.zip}...`);
  try {
    execSync(`unzip -o "${options.zip}" -d "${tempDir}"`, { stdio: 'ignore' });
    sourceDir = tempDir;
  } catch (e) {
    console.error("Error: Failed to extract zip archive using system 'unzip' command.");
    console.error("Please ensure 'unzip' is installed, or manually extract the archive and use the --dir option instead.");
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    process.exit(1);
  }
} else if (options.dir) {
  if (!fs.existsSync(options.dir)) {
    console.error(`Error: Directory does not exist: ${options.dir}`);
    process.exit(1);
  }
  sourceDir = options.dir;
}

// Process badge image
let imageFile = options.badgeImage;
if (!imageFile && sourceDir) {
  const allFilesForImg = scanDir(sourceDir);
  const imgExtensions = ['.png', '.svg', '.jpg', '.jpeg', '.gif'];
  imageFile = allFilesForImg.find(f => imgExtensions.includes(path.extname(f).toLowerCase()));
  if (imageFile) {
    console.log(`Automatically detected badge image: ${path.basename(imageFile)}`);
  }
}

if (imageFile) {
  if (!fs.existsSync(imageFile)) {
    console.error(`Error: Badge image file does not exist: ${imageFile}`);
    process.exit(1);
  }
  const ext = path.extname(imageFile).toLowerCase();
  let mimeType = 'image/png';
  if (ext === '.svg') mimeType = 'image/svg+xml';
  else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
  else if (ext === '.gif') mimeType = 'image/gif';
  
  const fileBuffer = fs.readFileSync(imageFile);
  if (ext === '.svg') {
    config.badgeImage = `data:${mimeType};utf8,${encodeURIComponent(fileBuffer.toString('utf8'))}`;
  } else {
    config.badgeImage = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  }
  console.log(`Badge image processed: ${path.basename(imageFile)}`);
}

if (sourceDir) {
  console.log(`Scanning directory: ${sourceDir}`);
  const allFiles = scanDir(sourceDir);
  const xmlFiles = allFiles.filter(f => f.toLowerCase().endsWith('.xml'));
  
  // Find potential appspace file
  const appspaceFile = allFiles.find(f => {
    const ext = path.extname(f).toLowerCase();
    if (ext === '.appspace' || ext === '.csv') return true;
    if (ext === '.txt') {
      const content = fs.readFileSync(f, 'utf8');
      return content.split('\n').some(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#') && (trimmed.includes('|') || trimmed.includes(',')) && !trimmed.startsWith('<');
      });
    }
    return false;
  });
  
  console.log(`Found ${xmlFiles.length} FOM XML files.`);
  
  for (const xmlFile of xmlFiles) {
    const name = path.basename(xmlFile);
    const xml = fs.readFileSync(xmlFile, 'utf8');
    const hash = getHashCode(xml);
    config.preloadedFiles.push({ name, xml, hash });
    console.log(`  - Preloaded: ${name} (hash: ${hash})`);
  }
  
  if (appspaceFile) {
    const name = path.basename(appspaceFile);
    const content = fs.readFileSync(appspaceFile, 'utf8');
    config.preloadedAppspace = {
      fileName: name,
      content: content
    };
    console.log(`Found and preloaded appspace file: ${name}`);
  } else {
    console.log('No appspace file found in the bundle.');
  }
}

// Generate bundle ID if we have preloaded files or custom branding
if (config.title || config.preloadedFiles.length > 0 || config.preloadedAppspace) {
  config.bundleId = 'bundle-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Write to custom-config.json
fs.writeFileSync(path.join(__dirname, '../src/custom-config.json'), JSON.stringify(config, null, 2));
console.log(`Configuration written to src/custom-config.json successfully.`);
console.log(`Bundle ID: ${config.bundleId}`);
console.log(`Bundle Mode: ${config.mode}`);

// Clean up temp directory
if (tempDir && fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
