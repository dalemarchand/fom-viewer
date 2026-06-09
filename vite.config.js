import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

function versionPlugin() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  let version;
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    if (branch === 'main') {
      version = pkg.version;
    } else {
      const gitDescribe = execSync('git describe --tags --always', { encoding: 'utf8' }).trim();
      const match = gitDescribe.match(/^(.*)-(\d+)-g([0-9a-f]+)$/);
      if (match) {
        version = `${match[1]}-${branch}.${match[2]}`;
      } else {
        const commitsAhead = execSync(`git rev-list --count ${gitDescribe}..HEAD`, { encoding: 'utf8' }).trim();
        version = `${gitDescribe}-${branch}.${commitsAhead}`;
      }
    }
  } catch (e) {
    version = pkg.version;
  }
  return {
    name: 'version-replace',
    transformIndexHtml(html) {
      return html.replace(/__VERSION__/g, version);
    }
  };
}

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  return {
    plugins: [
      svelte(),
      versionPlugin(),
      ...(isDev ? [] : [viteSingleFile()])
    ],
    build: {
      outDir: 'dist',
      cssCodeSplit: false,
      assetsInlineLimit: 100000000,
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      }
    }
  };
});
