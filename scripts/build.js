const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const version = pkg.version;

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');
const rootDir = path.join(__dirname, '..');

function build() {
  let htmlContent = fs.readFileSync(path.join(rootDir, 'fom-viewer.html'), 'utf8');

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

  const styleRegex = /<style>[\s\S]*?<\/style>/;
  if (styleRegex.test(htmlContent) && cssContent) {
    htmlContent = htmlContent.replace(styleRegex, `<style>\n${cssContent}\n</style>`);
  }

  const scriptRegex = /<script>[\s\S]*?<\/script>/;
  if (scriptRegex.test(htmlContent) && jsContent) {
    htmlContent = htmlContent.replace(scriptRegex, `<script>\n${jsContent}\n</script>`);
  }

  htmlContent = htmlContent.replace('</body>', `<!-- FOM Viewer v${version} -->\n</body>`);

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const outputPath = path.join(distDir, 'fom-viewer.html');
  fs.writeFileSync(outputPath, htmlContent, 'utf8');
  console.log(`Built: ${outputPath}`);
}

build();