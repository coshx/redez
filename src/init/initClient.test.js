const path = require('path');
const { readFile } = require('../helpers/fsHelper');

const {
  generateComponentLibCode,
} = require('./initClient.js');

const TEMPLATE_PATH = path.resolve('./src/templates');

describe('initClient', () => {
  describe('generateComponentLibCode', () => {
    const testInput = [
      {
        name: 'Component',
        path: './Component.js',
      },
      {
        name: 'Component2',
        path: './Component2.js',
      },
    ];

    test('Generates code identical to the template given the test input', async () => {
      const componentLib = await generateComponentLibCode(testInput);
      const template = await readFile(path.join(TEMPLATE_PATH, 'componentLib.js'), 'utf8');
      expect(componentLib.trim() === template.trim()).toBe(true);
    });
  });
});
