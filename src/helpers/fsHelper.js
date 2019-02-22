const fs = require('fs');
const path = require('path');
const util = require('util');

const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

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
  const files = await readdir(dir);
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

module.exports = {
  findFile,
};
