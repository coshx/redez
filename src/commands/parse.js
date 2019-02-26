const path = require('path');
const babelParser = require('@babel/parser');

const {
  readFile,
  writeFile,
} = require('../helpers/fsHelper');

async function parse(file) {
  const code = await readFile(path.resolve(process.cwd(), file), 'utf8');
  const AST = babelParser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  const outfile = `${path.basename(file).split('.')[0]}AST.json`;
  await writeFile(path.resolve(process.cwd(), outfile), JSON.stringify(AST));
}

module.exports = parse;
