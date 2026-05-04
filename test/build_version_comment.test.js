import { describe, test, expect } from 'bun:test';
import { execSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';

function countVersionComments(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(/<!--\s*FOM Viewer v[^>]*-->/g);
  return matches ? matches.length : 0;
}

describe('Build version comment duplication check', () => {
  const rootHtml = path.resolve(process.cwd(), 'fom-viewer.html');
  const distHtml = path.resolve(process.cwd(), 'dist', 'fom-viewer.html');

  test('build twice should not create duplicate FOM Viewer version comments', () => {
    // Run first build
    execSync('npm run build', { stdio: 'inherit' });
    const rootCountAfterFirst = countVersionComments(rootHtml);
    const distCountAfterFirst = countVersionComments(distHtml);

    // Run second build
    execSync('npm run build', { stdio: 'inherit' });
    const rootCountAfterSecond = countVersionComments(rootHtml);
    const distCountAfterSecond = countVersionComments(distHtml);

    // Validate: there should be 0 or 1 version comment in each file after the second build
    const rootOk = rootCountAfterSecond <= 1;
    const distOk = distCountAfterSecond <= 1;

    // Also ensure the first build did not already produce duplicates
    const rootFirstOk = rootCountAfterFirst <= 1;
    const distFirstOk = distCountAfterFirst <= 1;

    expect(rootFirstOk).toBe(true);
    expect(distFirstOk).toBe(true);
    expect(rootOk).toBe(true);
    expect(distOk).toBe(true);
  });
});
