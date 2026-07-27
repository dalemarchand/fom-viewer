import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('prepare-bundle.cjs CLI script', () => {
  const configPath = path.resolve(__dirname, '../src/custom-config.json');
  const backupConfigPath = path.resolve(__dirname, '../src/custom-config.json.bak');

  beforeAll(() => {
    // Back up original custom-config.json
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, backupConfigPath);
    }
  });

  afterAll(() => {
    // Restore backup config
    if (fs.existsSync(backupConfigPath)) {
      fs.copyFileSync(backupConfigPath, configPath);
      fs.unlinkSync(backupConfigPath);
    } else {
      fs.writeFileSync(configPath, '{}');
    }
  });

  const runPrepare = (args) => {
    execSync(`node scripts/prepare-bundle.cjs ${args}`, { cwd: path.resolve(__dirname, '..') });
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  };

  it('parses space-separated mode options', () => {
    const config1 = runPrepare('--mode strict');
    expect(config1.mode).toBe('strict');

    const config2 = runPrepare('--mode flexible');
    expect(config2.mode).toBe('flexible');
  });

  it('parses equals-separated mode options', () => {
    const config1 = runPrepare('--mode=strict');
    expect(config1.mode).toBe('strict');

    const config2 = runPrepare('--mode=flexible');
    expect(config2.mode).toBe('flexible');
  });

  it('handles case-insensitivity in mode parsing', () => {
    const config1 = runPrepare('--mode STRICT');
    expect(config1.mode).toBe('strict');

    const config2 = runPrepare('--mode=Strict');
    expect(config2.mode).toBe('strict');

    const config3 = runPrepare('--mode FLEXIBLE');
    expect(config3.mode).toBe('flexible');
  });

  it('parses other configuration fields with equals and spaces', () => {
    const config = runPrepare('--mode=strict --title="My Test Title" --badge-text="Test Badge" --badge-color=#123456');
    expect(config.mode).toBe('strict');
    expect(config.title).toBe('My Test Title');
    expect(config.badgeText).toBe('Test Badge');
    expect(config.badgeColor).toBe('#123456');
  });
});
