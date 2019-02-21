const path = require('path');

const {
  findFile,
  getFileExt,
} = require('./fsHelper');

const TEST_INPUT_DIR = path.resolve('./test-input');
const TEST_FILE = 'TestHelper.js';
const TEST_FILE_PATH = path.resolve(TEST_INPUT_DIR, `./src/helpers/${TEST_FILE}`);

describe('fsHelper', () => {
  describe('findFile', () => {
    test('Finds the given file in nested directories', async () => {
      const result = await findFile(TEST_FILE, TEST_INPUT_DIR, []);
      expect(result).toBe(TEST_FILE_PATH);
    });

    test('Does not look in excluded directories', async () => {
      const result = await findFile(TEST_FILE, TEST_INPUT_DIR, ['helpers']);
      expect(result).toBe(null);
    });
  });

  describe('getFileExt', () => {
    test('returns the file extension if the file at the given path', () => {
      expect(getFileExt('../test-input/src/App.jsx')).toBe('jsx');
    });

    test('returns null if the file / directory at the given path does not have an extension', () => {
      expect(getFileExt('../test-input/file')).toBe(null);
    });
  });
});
