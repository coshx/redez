const util = require('util');
const fs = require('fs');
const path = require('path');

const { spawn } = require('child_process');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const ncp = util.promisify(require('ncp').ncp);
const { Spinner } = require('cli-spinner');

const REDEZ_CLIENT_DIR_NAME = 'redez-client';
const SERVER_DIR = path.join(path.dirname(require.main.filename), '../');

async function initClient(config) {
  const clientInstalled = await isClientInstalled(config.getCfgPath());
  const installDir = path.join(config.getCfgPath(), REDEZ_CLIENT_DIR_NAME);

  if (!clientInstalled) {
    const installSpinner = new Spinner('Installing client... %s');
    installSpinner.start();
    await installClientAtTarget(config, installDir);
    installSpinner.stop(false);
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
  await addTargetProjectAsDependency(config, installDir);
}

async function copyClientToTarget(installDir) {
  await ncp(path.join(SERVER_DIR, REDEZ_CLIENT_DIR_NAME), installDir);
}

async function addTargetProjectAsDependency(config, installDir) {
  const packageDir = path.join(installDir, 'package.json');
  const packageCfg = JSON.parse(await readFile(packageDir));

  if (!packageCfg.dependencies.includes('redez-target')) {
    packageCfg.dependencies['redez-target'] = 'file:../.';
    await writeFile(packageDir, JSON.stringify(packageCfg));
  }
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
