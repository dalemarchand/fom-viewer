import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';

test('fom-viewer.html contains meta tag for version', () => {
  const htmlPath = new URL('../fom-viewer.html', import.meta.url);
  const html = readFileSync(htmlPath, 'utf8');

  // Extract head section
  const headMatch = html.match(/<head[^>]*>[\s\S]*?<\/head>/i);
  expect(headMatch).not.toBeNull();
  const head = headMatch ? headMatch[0] : '';

  // Check for meta tag with name="version" and content="__VERSION__"
  const metaRegex = /<meta\s+[^>]*name=["']version["'][^>]*content=["']__VERSION__["'][^>]*>/i;
  const found = metaRegex.test(head);
  expect(found).toBe(true);
});
