const util = require('util');
const fs = require('fs');
const path = require('path');

const { spawn } = require('child_process');

const readdir = util.promisify(fs.readdir);
const ncp = util.promisify(require('ncp').ncp);

const { findFile } = require('../helpers/fsHelper');

const REDEZ_CLIENT_DIR_NAME = 'redez-client';
const SERVER_DIR = path.join(path.dirname(require.main.filename), '../');

async function initClient(config) {
  const clientInstalled = await isClientInstalled(config.getCfgPath());
  const installDir = path.join(config.getCfgPath(), REDEZ_CLIENT_DIR_NAME);

  if (!clientInstalled) {
    console.log('Installing client');
    await installClientAtTarget(config, installDir);
  }

  startClient(installDir);
}

async function isClientInstalled(cfgDir) {
  const files = await readdir(cfgDir);
  if (files.includes(REDEZ_CLIENT_DIR_NAME)) {
    return true;
  }

  return false;
}

async function installClientAtTarget(config, installDir) {
  await copyClientToTarget(installDir);
  await copyWebpackConfigFromTarget(config, installDir);
  await copyPackageConfigFromTarget(config, installDir);
}

async function copyClientToTarget(installDir) {
  await ncp(path.join(SERVER_DIR, REDEZ_CLIENT_DIR_NAME), installDir);
}

// eslint-disable-next-line
async function copyPackageConfigFromTarget(config, installDir) {
  // Add all target dependencies to the editor
}

async function copyWebpackConfigFromTarget(config, installDir) {
  let webpackConfigPath = await findWebpackConfig(config, 'webpack.config.js');
  if (!webpackConfigPath) {
    webpackConfigPath = await findWebpackConfig(config, 'webpack.config.dev.js');
  }

  if (!webpackConfigPath) {
    console.error('Cannot locate webpack config in your project. Redez can only edit projects that use webpack');
    process.exit(1);
  }

  // Copy config into editor directory and rename
  await ncp(webpackConfigPath, path.join(installDir, 'target.webpack.config.js'));
}

async function findWebpackConfig(config, webpackConfigName) {
  let webpackConfigPath = await findFile(webpackConfigName, config.clientPath, ['node_modules']);

  if (!webpackConfigPath) {
    const nodeModulesPath = path.join(config.clientPath, 'node_modules');
    const modules = await readdir(nodeModulesPath);
    if (modules.includes('react-scripts')) {
      webpackConfigPath = await findFile(
        webpackConfigName,
        path.join(nodeModulesPath, 'react-scripts'),
        ['node_modules'],
      );
    }
  }

  return webpackConfigPath;
}


async function startClient(installDir) {
  process.chdir(installDir);

  // Attempt to start editor
  const start = spawn('npm', ['start']);
  start.on('exit', (startExitCode) => {
    // Try npm install if it fails
    if (startExitCode > 0) {
      const install = spawn('npm', ['install']);
      console.log('Installing editor dependencies... ');

      let installationErrors = '';

      install.stderr.on('data', (data) => {
        installationErrors += data.toString();
      });

      install.on('exit', (installExitCode) => {
        if (installExitCode <= 0) {
          console.log('Installation complete');
          spawn('npm', ['start']);
        } else {
          console.error('Installation failed. Errors from npm install:');
          console.error(installationErrors);
          process.exit(1);
        }
      });
    }
  });
}


module.exports = initClient;
