const fs = require('fs');
const path = require('path');
const util = require('util');

const readDir = util.promisify(fs.readdir);
const mkDir = util.promisify(fs.mkdir);
const stat = util.promisify(fs.stat);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const exists = util.promisify(fs.exists);

/**
 * Recursively search the directory for a file
 * return the path of the first instance found
 *
 * @param {string} filename name of the file to look for
 * @param {string} path of the directory to search
 * @param {Array} exclude list of directories to ignore
 *
 * @returns {string} The path of the first instance of the file found
 */
async function findFile(filename, dir, exclude) {
  const files = await readDir(dir);
  if (files.includes(filename)) {
    return path.join(dir, filename);
  }

  const resultPromises = files
    .filter(file => !exclude.includes(file))
    .map(async (file) => {
      const fPath = path.resolve(dir, file);
      const fStat = await stat(fPath);
      if (fStat && fStat.isDirectory()) {
        return findFile(filename, fPath, exclude);
      }

      return Promise.resolve(null);
    });

  // Return the first instance of the file that we find
  return Promise.race(resultPromises
    .map(p => new Promise(
      // Map the result promises to a new list of promises that only resolves if the file is found
      (resolve, reject) => p.then(v => v && resolve(v), reject),
    )).concat(Promise.all(resultPromises).then(() => null))); // Handle case where no file is found
}

function getFileExt(filePath) {
  const splitName = path.basename(filePath).split('.');
  if (splitName.length < 2) {
    return null;
  }

  return splitName[splitName.length - 1];
}

module.exports = {
  findFile,
  getFileExt,
  readFile,
  writeFile,
  readDir,
  mkDir,
  exists,
  stat,
};
