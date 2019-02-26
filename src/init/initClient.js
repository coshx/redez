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
    const installSpinner = new Spinner('Installing editor... %s');
    installSpinner.start();
    await installClientAtTarget(config, installDir);
    installSpinner.stop(false);
  }

  const startSpinner = new Spinner('Starting editor... %s');
  startSpinner.start();
  await startClient(installDir);
  startSpinner.stop(false);
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
  const clientSrcPath = path.join(SERVER_DIR, REDEZ_CLIENT_DIR_NAME);
  await ncp(clientSrcPath, installDir);
}

async function addTargetProjectAsDependency(config, installDir) {
  const packageDir = path.join(installDir, 'package.json');
  const packageCfg = JSON.parse(await readFile(packageDir));

  if (!('redez-target' in packageCfg.dependencies)) {
    packageCfg.dependencies['redez-target'] = 'file:../../.';
    await writeFile(packageDir, JSON.stringify(packageCfg));
  }
}

// /** Generate a componentLib.js file that imports
//     all components in the target project */
// async function generateComponentLib(config) {
// }

// /** Use babel to transpile the target source code and store in the
//     .redez directory so it can be imported by the editor */
// async function transpileTarget(config) {
// }

// /** Adds the module field to the target project's package.json
//     so that the editor can add it as a dependency */
// async function addModuleConfigToTarget(config) {
// }

// /** Creates a map from component path to component for use by the editor */
// async function generateComponentMap(config, installDir) {
// }

async function startClient(installDir) {
  process.chdir(installDir);

  return new Promise((resolve, reject) => {
    // Attempt to start editor
    let start = spawn('yarn', ['start']);
    let startFailure = false;

    start.on('exit', (startExitCode) => {
      // Try npm install if it fails
      if (startExitCode > 0) {
        startFailure = true;
        const startSpinner = new Spinner('Installing editor dependencies... %s');
        startSpinner.start();
        const install = spawn('yarn', ['install']);

        let installationMessages = '';
        let installationErrors = '';

        install.stdout.on('data', (data) => {
          installationMessages += data.toString();
        });


        install.stderr.on('data', (data) => {
          installationErrors += data.toString();
        });

        install.on('exit', (installExitCode) => {
          startSpinner.stop(false);
          if (installExitCode <= 0) {
            start = spawn('yarn', ['start']);
            resolve(start);
          } else {
            console.error('Installation failed. Errors from npm install:');
            console.log(installationMessages);
            console.error(installationErrors);
            process.exit(1);
            reject(installationErrors);
          }
        });
      }
    });

    setTimeout(() => {
      if (!startFailure) {
        resolve(start);
      }
    }, 3000);
  });
}


module.exports = initClient;
