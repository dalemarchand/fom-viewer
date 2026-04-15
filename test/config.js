const path = require('path');

const config = {
  app: {
    htmlPath: path.resolve(__dirname, '../fom-viewer.html'),
    baseUrl: `file://${path.resolve(__dirname, '../fom-viewer.html')}`
  },
  test: {
    fomDir: path.resolve(__dirname, 'fom'),
    timeout: 10000,
    waitForSelector: 2000
  },
  browser: {
    headless: true,
    slowMo: 10,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  selectors: {
    tabs: '.tab-bar-scroll .tab',
    tabSections: {
      modules: '.tab[data-tab="modules"]',
      infrastructure: '.tab[data-tab="infrastructure"]',
      documentation: '.tab[data-tab="documentation"]'
    },
    treeItem: '.tree-item',
    detailHeader: '.detail-header',
    detailBody: '.detail-body',
    backBtn: '#backBtn',
    globalSearch: '#globalSearch',
    fileInput: '#fileInput',
    clearBtn: '#clearBtn'
  },
  testFiles: [
    'HLAstandardMIM.xml',
    'RPR-Foundation_v3.0.xml',
    'RPR-Physical_v3.0.xml',
    'RPR-Enumerations_v3.0.xml',
    'RPR-Base_v3.0.xml',
    'RPR-Aggregate_v3.0.xml',
    'RPR-Communication_v3.0.xml',
    'RPR-DER_v3.0.xml'
  ]
};

module.exports = config;