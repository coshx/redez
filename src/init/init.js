// ** Initialization

const chalk = require('chalk');

const initConfig = require('./initConfig');
const initClient = require('./initClient');

const { generateComponentTrees } = require('./componentTreeGenerator');

async function init() {
  console.log('\n');
  console.log(chalk.green('Redez'));
  console.log('\n');

  const config = await initConfig();
  config.componentTrees = await generateComponentTrees(config);

  await initClient(config);

  return config;
}

module.exports = init;
