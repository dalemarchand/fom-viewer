const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const pkg = require('../package.json');
let version;
try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  if (branch === 'main') {
    version = pkg.version;
  } else {
    const gitDescribe = execSync('git describe --tags --always', { encoding: 'utf8' }).trim();
    // git describe outputs <tag>-<n>-g<hash> when not at a tag
    const match = gitDescribe.match(/^(.*)-(\d+)-g([0-9a-f]+)$/);
    if (match) {
      // Extract tag name and commit count from describe output
      version = `${match[1]}-${branch}.${match[2]}`;
    } else {
      // At a tag exactly, or no tags exist (uses commit hash)
      const commitsAhead = execSync(`git rev-list --count ${gitDescribe}..HEAD`, { encoding: 'utf8' }).trim();
      version = `${gitDescribe}-${branch}.${commitsAhead}`;
    }
  }
} catch (e) {
  version = pkg.version; // fallback
}

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');
const rootDir = path.join(__dirname, '..');

function generateSourceMap(jsContent, sourceFile) {
  const map = {
    version: 3,
    file: sourceFile,
    sources: [sourceFile],
    sourcesContent: [jsContent],
    mappings: ''
  };
  return JSON.stringify(map);
}

function build({ sourcemap = false, external = false } = {}) {
  let htmlContent = fs.readFileSync(path.join(rootDir, 'fom-viewer.html'), 'utf8');

  // Replace __VERSION__ placeholder with actual version from package.json
  htmlContent = htmlContent.replace('__VERSION__', version);

  const cssPath = path.join(srcDir, 'styles.css');
  let cssContent = '';
  if (fs.existsSync(cssPath)) {
    cssContent = fs.readFileSync(cssPath, 'utf8');
  }

  const jsPath = path.join(srcDir, 'main.js');
  let jsContent = '';
  if (fs.existsSync(jsPath)) {
    jsContent = fs.readFileSync(jsPath, 'utf8');
  }

  if (external) {
    const cssFile = 'src/styles.css';
    const jsFile = 'src/main.js';
    htmlContent = htmlContent.replace(
      /<style>[\s\S]*?<\/style>/,
      `<link rel="stylesheet" href="${cssFile}">`
    );
    htmlContent = htmlContent.replace(
      /<script>[\s\S]*?<\/script>/,
      `<script src="${jsFile}"></script>`
    );

    if (sourcemap) {
      const jsMapPath = path.join(srcDir, 'main.js.map');
      fs.writeFileSync(jsMapPath, generateSourceMap(jsContent, 'main.js'), 'utf8');
      console.log(`Source map: ${jsMapPath}`);

      const cssMapPath = path.join(srcDir, 'styles.css.map');
      const cssMap = JSON.stringify({
        version: 3,
        file: 'styles.css',
        sources: ['styles.css'],
        sourcesContent: [cssContent],
        mappings: ''
      }, null, 2);
      fs.writeFileSync(cssMapPath, cssMap, 'utf8');
      console.log(`Source map: ${cssMapPath}`);
    }
  } else {
    const styleRegex = /<style>[\s\S]*?<\/style>/;
    if (styleRegex.test(htmlContent) && cssContent) {
      htmlContent = htmlContent.replace(styleRegex, `<style>\n${cssContent}\n</style>`);
    }

    const scriptRegex = /<script>[\s\S]*?<\/script>/;
    if (scriptRegex.test(htmlContent) && jsContent) {
      let wrappedJs = jsContent;
      if (sourcemap) {
        const jsMapPath = path.join(distDir, 'main.js.map');
        fs.writeFileSync(jsMapPath, generateSourceMap(jsContent, 'main.js'), 'utf8');
        console.log(`Source map: ${jsMapPath}`);

        wrappedJs = `${jsContent}\n//# sourceMappingURL=main.js.map`;
      }
      htmlContent = htmlContent.replace(scriptRegex, `<script>\n${wrappedJs}\n</script>`);
    }
  }

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const outputPath = path.join(distDir, external ? 'fom-viewer-dev.html' : 'fom-viewer.html');
  fs.writeFileSync(outputPath, htmlContent, 'utf8');
  console.log(`Built: ${outputPath}${external ? ' (external mode)' : ''}`);
  
  if (!external) {
    const rootPath = path.join(rootDir, 'fom-viewer.html');
    fs.writeFileSync(rootPath, htmlContent, 'utf8');
    console.log(`Copied to: ${rootPath}`);
  }
}

const args = process.argv.slice(2);
const options = {
  sourcemap: args.includes('--sourcemap'),
  external: args.includes('--external')
};

build(options);