// * react-apollo-magic-glue

const commander = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');

const util = require('util');
const fs = require('fs');
const path = require('path');
const exec = util.promisify(require('child_process').exec);

const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);

const generate = require('./commands/generate');

// ** Constants
const SERVER_CFG_NAME = 'react-apollo-magic-glue-server-cfg.json';
const CLIENT_CFG_NAME = 'react-apollo-magic-glue-client-cfg.json';
const DESCRIPTION = 'Easily generate endpoints for Apollo Server along with React components that retrieve and display the data';

// ** Command Structure
commander
  .version('0.0.1')
  .description(DESCRIPTION);

commander
  .command('generate')
  .alias('g')
  .description('Add a new resource with corresponding endpoints and views')
  .action(runCommand(generate));

commander
  .command('*', { noHelp: true })
  .action(() => {
    commander.help();
  });

// Display help if no command is specified
commander.parse(process.argv);
if (process.argv.length < 3) {
  commander.help();
}

// ** Initialization

async function runCommand(command) {
  const config = await init();
  await command(config);
}

async function init() {
  console.log('\n');
  console.log(chalk.green('react-apollo-magic-glue'));
  console.log(DESCRIPTION);
  console.log('\n');
  return verifyConfig();
}

// *** Configuration File
/**
 * Find and load a configuration file
 * Or generate a new one if it is not found
 *
 * @returns {Object}
 */
async function verifyConfig() {
  const configPath = await getConfigPath();
  return configPath
    ? JSON.parse(fs.readFileSync(configPath))
    : generateConfig();
}

/**
* If the project is a git repo, find the config at the repo root
* Otherwise look in the current directory
*
* @returns {String} or null if config not found
*/
async function getConfigPath() {
  let cfgPath;
  const repoPath = await getCurrentGitRepoPath();

  if (repoPath) {
    cfgPath = await configSearch(repoPath);
  }

  if (!cfgPath) {
    cfgPath = await configSearch(`${process.cwd()}/`);
  }

  return cfgPath;
}

/**
 * Get the path
 * Otherwise look in the current directory
 *
 * @returns {String} The repo root path or null if repo not found
 */
async function getCurrentGitRepoPath() {
  const { stdout } = await exec('git rev-parse --git-dir').catch(() => ({ stdout: null }));

  if (!stdout || stdout.trim() === '.git') {
    return null;
  }

  return stdout.replace('.git', '');
}

/**
 * Search for a config file in the given path
 *
 * @returns {String} The config file path or null if config not found
 */
async function configSearch(startPath) {
  if (fs.existsSync(startPath)) {
    const files = await readdir(startPath);
    if (files.includes(SERVER_CFG_NAME)) {
      return `${startPath}${SERVER_CFG_NAME}`;
    }

    // If only the client config file is found, get the server path and search there
    if (files.includes(CLIENT_CFG_NAME)) {
      const clientConfig = JSON.parse(fs.readFileSync(`${startPath}${CLIENT_CFG_NAME}`));
      if (clientConfig.serverPath) {
        return configSearch(clientConfig.serverPath);
      }
    }
  }

  return null;
}

/**
 * Get necessary input from the user in order to generate a config file
 *
 * @returns {Object} The config data from the generated file
 */
async function generateConfig() {
  console.log("Can't find a valid config file. Please answer the following questions in order to create one");
  const {
    serverPath,
    clientPath,
    componentPath,
    generateCSSModules,
  } = await inquirer.prompt([
    {
      name: 'clientPath',
      type: 'input',
      default: '.',
      message: 'What is the path to your frontend (React/Apollo Client) project?',
    },
    {
      name: 'componentPath',
      type: 'input',
      default: '/components',
      message: 'What directory should React components be generated in? (relative to frontend root)',
    },
    {
      name: 'serverPath',
      type: 'input',
      default: '.',
      message: 'What is the path to your backend (Apollo Server) project?',
    },
    {
      name: 'generateCSSModules',
      type: 'confirm',
      message: 'Would you like to generate CSS modules alongside your React components?',
    },
  ]);

  const initialServerConfig = {
    serverPath,
    clientPath,
    componentPath: `${clientPath}/${componentPath}`,
    generateCSSModules,
  };

  const initialClientConfig = {
    serverPath: path.relative(clientPath, serverPath),
  };

  await Promise.all([
    writeFile(`${serverPath}/${SERVER_CFG_NAME}`, JSON.stringify(initialServerConfig)),
    writeFile(`${clientPath}/${CLIENT_CFG_NAME}`, JSON.stringify(initialClientConfig)),
  ]);

  console.log('\n');
  console.log('Configuration files generated');
  console.log('\n');

  return initialServerConfig;
}
