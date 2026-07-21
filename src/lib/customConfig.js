import configData from '../custom-config.json';

const customConfig = {
  title: configData.title || '',
  badgeText: configData.badgeText || '',
  badgeColor: configData.badgeColor || '',
  badgeTextColor: configData.badgeTextColor || '',
  badgeImage: configData.badgeImage || '',
  preloadedFiles: configData.preloadedFiles || [],
  preloadedAppspace: configData.preloadedAppspace || null,
  bundleId: configData.bundleId || '',
  mode: configData.mode || 'flexible'
};

export default customConfig;
