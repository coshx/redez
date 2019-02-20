const util = require('util');
const fs = require('fs');
const path = require('path');

const { spawn } = require('child_process');

const readdir = util.promisify(fs.readdir);
const ncp = util.promisify(require('ncp').ncp);

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
  await updateWebpackConfigFromTarget(config, installDir);
}

async function copyClientToTarget(installDir) {
  await ncp(path.join(SERVER_DIR, REDEZ_CLIENT_DIR_NAME), installDir);
}

// eslint-disable-next-line
async function updateWebpackConfigFromTarget(config, installDir) {
}

async function startClient(installDir) {
  process.chdir(installDir);
  const start = spawn('npm', ['start']);

  start.on('exit', (code) => {
    if (code > 0) {
      const install = spawn('npm', ['install']);
      console.log('Installing editor dependencies... ');

      install.on('exit', () => {
        console.log('Installation complete');
        spawn('npm', ['start']);
      });
    }
  });
}


module.exports = initClient;
