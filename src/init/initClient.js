const util = require('util');
const path = require('path');
const { spawn } = require('child_process');

const ncp = util.promisify(require('ncp').ncp);
const { Spinner } = require('cli-spinner');
const babelParser = require('@babel/parser');
const babelGenerate = require('@babel/generator').default;

const {
  readDir,
  readFile,
  writeFile,
} = require('../helpers/fsHelper');

const { getComponentPathsInProjectSrc } = require('./componentTreeGenerator');

const REDEZ_CLIENT_DIR_NAME = 'redez-client';
const SERVER_DIR = path.join(path.dirname(require.main.filename), '../');
const TEMPLATE_PATH = path.join(SERVER_DIR, './templates');

async function initClient(config) {
  const clientInstalled = await isClientInstalled(config.cfgPath);
  const installDir = path.join(config.cfgPath, REDEZ_CLIENT_DIR_NAME);

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
  const files = await readDir(cfgDir);
  if (files.includes(REDEZ_CLIENT_DIR_NAME)) {
    return true;
  }

  return false;
}

async function installClientAtTarget(config, installDir) {
  await copyClientToTarget(installDir);
  await addTargetProjectAsDependency(config, installDir);

  await generateComponentLib(config);
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

async function generateComponentLib(config) {
  const libPath = path.join(config.cfgPath, 'componentLib.js');

  const targetComponents = await getComponentList(config, libPath);
  const generatedLib = await generateComponentLibCode(targetComponents);

  await writeFile(libPath, generatedLib);
}

async function getComponentList(config, startPath) {
  const allComponentPaths = getComponentPathsInProjectSrc(config);
  return allComponentPaths.map(compPath => ({
    path: path.relative(startPath, compPath),
    name: path.basename(compPath).split('.')[0],
  }));
}

/** Generate a componentLib.js file that imports
*   all components in the target project
*
* @param {Array} components An array of objects containing the name and path of a component
*/
async function generateComponentLibCode(components) {
  const libTemplate = await readFile(path.join(TEMPLATE_PATH, 'componentLib.js'), 'utf8');
  const AST = babelParser.parse(libTemplate, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  const importDeclarations = generateImportDeclarations(components);
  const exportDeclaration = generateExportDeclaration(components);

  AST.program.body = [...importDeclarations, exportDeclaration];

  return babelGenerate(AST).code;
}

function generateImportDeclarations(components) {
  return components.map(component => ({
    type: 'ImportDeclaration',
    source: {
      type: 'StringLiteral',
      value: component.path,
      extra: { rawValue: component.path, raw: `'${component.path}'` },
    },
    specifiers: [{
      type: 'ImportDefaultSpecifier',
      local: {
        type: 'Identifier',
        name: component.name,
      },
    }],
  }));
}

function generateExportDeclaration(components) {
  return {
    type: 'ExportNamedDeclaration',
    specifiers: components.map((component) => {
      const id = {
        type: 'Identifier',
        name: component.name,
      };

      return {
        type: 'ExportSpecifier',
        exported: id,
        local: id,
      };
    }),
    source: null,
    declaration: null,
  };
}

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


module.exports = {
  initClient,
  generateComponentLibCode,
};
