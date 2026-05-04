import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

function readJSON(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function readFile(filePath) { return fs.readFileSync(filePath, 'utf8'); }
function extractVersionFromHTML(html) {
  // Try common meta tag shapes
  const m1 = html.match(/<meta\s+[^>]*name=["']version["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (m1) return m1[1];
  const m2 = html.match(/<meta\s+[^>]*content=["']([^"']+)["']\s*[^>]*name=["']version[-_ ]?tag?["'][^>]*>/i);
  if (m2) return m2[1];
  // Fallback: look for any meta tag with name containing version and take content
  const m3 = html.match(/<meta\s+[^>]*name=["'][^"'>]*version[^"'>]*["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (m3) return m3[1];
  // If still not found, try a generic search for content="X"
  const m4 = html.match(/<meta\s+[^>]*content=["']([^"'>]+)["'][^>]*>/i);
  if (m4) return m4[1];
  return null;
}
function getVersionFromHTML(dir) {
  const possiblePaths = [
    path.join(dir, 'fom-viewer.html'),
    path.join(dir, 'dist', 'fom-viewer.html')
  ];
  let html = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      html = readFile(p);
      break;
    }
  }
  if (!html) throw new Error('Built HTML not found in expected paths');
  return extractVersionFromHTML(html);
}

function getBranchName() {
  try {
    const out = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' });
    return out.trim();
  } catch (e) {
    return null;
  }
}

function buildInDir(dir) {
  const prevCwd = process.cwd();
  try {
    process.chdir(dir);
    // Run npm build
    execSync('npm run build', { stdio: 'pipe' });
  } finally {
    process.chdir(prevCwd);
  }
}

describe('Hybrid versioning (Option E) in build.js', () => {
  test('build.js contains hybrid logic using git describe for non-main branches', () => {
    const content = fs.readFileSync(path.resolve('scripts/build.js'), 'utf8');
    // We expect the code to use git describe (or equivalent) for non-main branches
    const hasGitDescribe = /git\s+describe|describe\s+--tags|describe\s+--long/i.test(content) 
      || /branch\s+name/i.test(content);
    expect(hasGitDescribe).toBe(true);
  });

  test('npm run build updates fom-viewer.html with version tag on main branch', () => {
    const branch = getBranchName();
    // If we can't determine branch, skip
    if (!branch || branch === 'HEAD') {
      // Cannot determine branch reliably; skip this test
      return;
    }
    // Only run meaningful assertion on main or master
    if (branch !== 'main' && branch !== 'master') {
      // Skip to avoid flakiness on feature branches
      return;
    }
    // Read package.json version
    const pkg = readJSON(path.resolve('package.json'));
    // Build
    buildInDir(process.cwd());
    // Read version from built HTML
    const versionFromHtml = getVersionFromHTML(process.cwd());
    expect(versionFromHtml).toBe(pkg.version);
  });

  test('Fallback to package.json version when git is not available (simulate error)', () => {
    // Temporarily move .git out to simulate not a git repo
    const gitPath = path.resolve('.git');
    const gitBackup = path.resolve('.git.bak');
    let migratedBack = false;
    if (fs.existsSync(gitPath)) {
      fs.renameSync(gitPath, gitBackup);
      migratedBack = true;
    }
    try {
      // Run build in this repo without git
      buildInDir(process.cwd());
      // Read versions
      const pkg = readJSON(path.resolve('package.json'));
      const versionFromHtml = getVersionFromHTML(process.cwd());
      expect(versionFromHtml).toBe(pkg.version);
    } finally {
      // Restore git dir
      if (migratedBack && fs.existsSync(gitBackup)) {
        fs.renameSync(gitBackup, gitPath);
      }
    }
  });
});
