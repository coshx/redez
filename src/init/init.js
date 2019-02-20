// ** Initialization

const chalk = require('chalk');
const path = require('path');

const initConfig = require('./initConfig');
const initClient = require('./initClient');

async function init() {
  console.log('\n');
  console.log(chalk.green('Redez'));
  console.log('\n');

  const config = await initConfig();

  await initClient(config);

  console.log(config);
  return Object.assign({}, config, {
    srcPath: path.join(config.clientPath, config.srcPath),
    rootComponentPath: path.join(config.srcPath, config.rootComponentPath),
  });
}

module.exports = init;
