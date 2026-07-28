import { describe, it, expect } from 'vitest';
import customConfig from '../src/lib/customConfig.js';

describe('customConfig', () => {
  it('has all required properties and correct fallback types', () => {
    expect(customConfig).toHaveProperty('title');
    expect(typeof customConfig.title).toBe('string');

    expect(customConfig).toHaveProperty('badgeText');
    expect(typeof customConfig.badgeText).toBe('string');

    expect(customConfig).toHaveProperty('badgeColor');
    expect(typeof customConfig.badgeColor).toBe('string');

    expect(customConfig).toHaveProperty('badgeTextColor');
    expect(typeof customConfig.badgeTextColor).toBe('string');

    expect(customConfig).toHaveProperty('badgeImage');
    expect(typeof customConfig.badgeImage).toBe('string');

    expect(customConfig).toHaveProperty('preloadedFiles');
    expect(Array.isArray(customConfig.preloadedFiles)).toBe(true);

    expect(customConfig).toHaveProperty('preloadedAppspace');
    // Can be null or object
    if (customConfig.preloadedAppspace !== null) {
      expect(typeof customConfig.preloadedAppspace).toBe('object');
    }

    expect(customConfig).toHaveProperty('bundleId');
    expect(typeof customConfig.bundleId).toBe('string');

    expect(customConfig).toHaveProperty('mode');
    expect(['strict', 'flexible']).toContain(customConfig.mode);
  });
});
