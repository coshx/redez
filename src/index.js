#!/usr/bin/env node
// * redez-server

const commander = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');

const util = require('util');
const fs = require('fs');
const path = require('path');

const exec = util.promisify(require('child_process').exec);

const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);
const readdir = util.promisify(fs.readdir);

const start = require('./commands/start');

// ** Constants
const SERVER_CFG_NAME = 'server-cfg.json';
const CLIENT_CFG_NAME = 'client-cfg.json';
const DESCRIPTION = 'Easily generate endpoints for Apollo Server along with React components that retrieve and display the data';

// ** Command Structure
commander
  .version('0.0.1')
  .description(DESCRIPTION);

commander
  .command('start')
  .alias('s')
  .description('Start the editor in the current project')
  .action(runCommand(start));

commander
  .command('*', { noHelp: true })
  .action(() => {
    commander.help();
  });

// ** Initialization

async function runCommand(command) {
  const config = await init();
  await command(config);
}

async function init() {
  console.log('\n');
  console.log(chalk.green('Redez'));
  console.log('\n');

  const config = verifyConfig();
  return Object.assign({}, config, {
    rootComponentPath: path.join(config.clientPath, config.rootComponentPath),
  });
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
  return configPath ? Object.assign(
    JSON.parse(fs.readFileSync(configPath)),
    { clientPath: path.resolve(configPath, '../..') },
  ) : generateConfig();
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
    cfgPath = await configSearch(process.cwd());
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
  let stdout = null;
  try {
    ({ stdout } = await exec('git rev-parse --git-dir'));

    if (stdout.trim() === '.git') {
      return null;
    }

    return stdout.replace('.git', '');
  } catch (err) {
    return null;
  }
}

/**
 * Search for a config file in the given path
 *
 * @returns {String} The config file path or null if config not found
 */
async function configSearch(startPath) {
  const cfgPath = path.join(startPath, '.redez');
  if (fs.existsSync(cfgPath)) {
    const files = await readdir(cfgPath);
    if (files.includes(CLIENT_CFG_NAME)) {
      return path.join(cfgPath, CLIENT_CFG_NAME);
    }

    // If only the client config file is found, get the server path and search there
    if (files.includes(SERVER_CFG_NAME)) {
      const serverConfig = JSON.parse(fs.readFileSync(path.join(cfgPath, SERVER_CFG_NAME)));
      if (serverConfig.clientPath) {
        return configSearch(serverConfig.clientPath);
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
    clientPath,
    srcPath,
    rootComponentPath,
    serverPath,
  } = await inquirer.prompt([
    {
      name: 'clientPath',
      type: 'input',
      default: '.',
      message: 'What is the path to your frontend (React/Apollo Client) project?',
    },
    {
      name: 'srcPath',
      type: 'input',
      default: './src',
      message: 'What is the relative path to the source directory of your app?',
    },
    {
      name: 'rootComponentPath',
      type: 'input',
      default: './App.js',
      message: 'What is the path to the root component of your app relative to the soruce directory?',
    },
    {
      name: 'serverPath',
      type: 'input',
      default: '.',
      message: 'What is the path to your backend (Apollo Server) project?',
    },
  ]);

  const initialServerConfig = {
    clientPath: path.relative(serverPath, clientPath),
  };

  const initialClientConfig = {
    clientPath: path.resolve(clientPath),
    serverPath: path.relative(clientPath, serverPath),
    srcPath,
    rootComponentPath,
  };

  const serverCfgDir = path.join(serverPath, '.redez');
  const clientCfgDir = path.join(clientPath, '.redez');

  await Promise.all([
    mkdir(serverCfgDir),
    mkdir(clientCfgDir),
  ]);

  await Promise.all([
    writeFile(path.join(serverCfgDir, SERVER_CFG_NAME), JSON.stringify(initialServerConfig)),
    writeFile(path.join(clientCfgDir, CLIENT_CFG_NAME), JSON.stringify(initialClientConfig)),
  ]);

  console.log('\n');
  console.log('Configuration files generated');
  console.log('\n');

  return initialClientConfig;
}
