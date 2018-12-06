#!/usr/bin/env node

const DESCRIPTION = 'Easily generate endpoints for Apollo Server along with React components that retrieve and display the data';

const commander = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const path = require('path');

const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);
// const shell = require('shelljs');

const SERVER_CFG_NAME = 'react-apollo-magic-glue-server-cfg.json';
const CLIENT_CFG_NAME = 'react-apollo-magic-glue-client-cfg.json';

commander
  .version('0.0.1')
  .description(DESCRIPTION);

commander
  .command('generate')
  .alias('g')
  .description('Add a new resource with corresponding endpoints and views')
  .action(addResource);

commander
  .command('*', { noHelp: true })
  .action(() => {
    commander.help();
  });

async function addResource() {
  welcome();
  const output = await verifyConfig();

  const {
    resourceName,
    shouldGenerateCollectionView,
    shouldGenerateDetailView,
  } = await inquirer.prompt([
    {
      name: 'resourceName',
      type: 'input',
      message: 'What is the name of your new resource? (singular form)',
    },
    {
      name: 'shouldGenerateDetailView',
      type: 'confirm',
      message: 'Do you want a detail view for your new resource?',
    },
    {
      name: 'shouldGenerateCollectionView',
      type: 'confirm',
      message: 'Do you want a collection view for your new resource?',
    },
  ]);

  output.name = resourceName;

  if (shouldGenerateDetailView) {
    output.detailViewFields = [];
  }

  if (shouldGenerateCollectionView) {
    output.collectionViewFields = [];
  }

  await resourceFieldPromptLoop(output);

  console.log(output);
}

function welcome() {
  console.log('\n');
  console.log(chalk.green('react-apollo-magic-glue'));
  console.log(DESCRIPTION);
  console.log('\n');
}

/* Try to find a configuration file - generate one if it can't be found */
async function verifyConfig() {
  const configPath = await getConfigPath();
  return configPath
    ? JSON.parse(fs.readFileSync(configPath))
    : generateConfig();

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
      componentPath: `${componentPath}/`,
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

  /* Get the root path of the git repo that the tool is being run in */
  async function getCurrentGitRepoPath() {
    const { stdout } = await exec('git rev-parse --git-dir').catch(() => ({ stdout: null }));

    if (!stdout || stdout.trim() === '.git') {
      return null;
    }

    return stdout.replace('.git', '');
  }

  /* Search for the server configuration file in the given directory */
  async function configSearch(startPath) {
    if (fs.existsSync(startPath)) {
      const files = await readdir(startPath);
      if (files.includes(SERVER_CFG_NAME)) {
        return `${startPath}${SERVER_CFG_NAME}`;
      }

      /* If only the client config file is found, get the server path and search there */
      if (files.includes(CLIENT_CFG_NAME)) {
        const clientConfig = JSON.parse(fs.readFileSync(`${startPath}${CLIENT_CFG_NAME}`));
        if (clientConfig.serverPath) {
          return configSearch(clientConfig.serverPath);
        }
      }
    }

    return null;
  }
}

async function resourceFieldPromptLoop(output) {
  let addNextField = true;
  let fieldCount = 0;

  while (addNextField) {
    console.log('\n');
    addNextField = await nextFieldPrompt(fieldCount);

    if (!addNextField) {
      return;
    }

    const fieldData = {
      name: await fieldNamePrompt(),
      type: await fieldTypePrompt(),
    };

    const { addFieldToCollectionView, addFieldToDetailView } = await whichViewPrompt(output);

    if (addFieldToCollectionView) {
      output.collectionViewFields.push(fieldData);
    }

    if (addFieldToDetailView) {
      output.detailViewFields.push(fieldData);
    }

    fieldCount += 1;
  }
}

async function nextFieldPrompt(fieldCount) {
  const answer = await inquirer.prompt([{
    name: 'addNextField',
    type: 'confirm',
    message: fieldCount === 0 ? 'Add fields for this resource?' : 'Add another field?',
  }]);

  return answer.addNextField;
}

async function fieldNamePrompt() {
  const answer = await inquirer.prompt([{
    name: 'fieldName',
    type: 'input',
    message: 'Enter field name:',
  }]);
  return answer.fieldName;
}

async function fieldTypePrompt() {
  let { fieldType } = await inquirer.prompt([{
    name: 'fieldType',
    type: 'rawlist',
    choices: [
      'Int',
      'Float',
      'String',
      'Boolean',
      'ID',
      'Custom',
    ],
    default: 0,
    message: 'Choose the field type',
  }]);

  if (fieldType === 'Custom') {
    const answer = await inquirer.prompt([{
      name: 'customFieldType',
      type: 'input',
      message: 'Enter your custom type name:',
    }]);
    fieldType = answer.customFieldType;
  }

  return fieldType;
}

async function whichViewPrompt(output) {
  let addFieldToCollectionView = false;
  let addFieldToDetailView = false;

  if (output.collectionViewFields && output.detailViewFields) {
    const { whichView } = await inquirer.prompt([{
      name: 'whichView',
      type: 'rawlist',
      choices: [
        'None',
        'Detail',
        'Collection',
        'Both',
      ],
      default: 0,
      message: 'Which views should this field be displayed in?',
    }]);

    switch (whichView) {
      case 'Detail':
        addFieldToDetailView = true;
        break;
      case 'Collection':
        addFieldToCollectionView = true;
        break;
      case 'Both':
        addFieldToDetailView = true;
        addFieldToCollectionView = true;
        break;
      default:
    }
  } else if (output.collectionViewFields || output.detailViewFields) {
    const { addToView } = await inquirer.prompt([{
      name: 'addToView',
      type: 'confirm',
      message: 'Add this field to the view?',
    }]);

    if (addToView) {
      addFieldToCollectionView = Array.isArray(output.collectionViewFields);
      addFieldToDetailView = Array.isArray(output.detailViewFields);
    }
  }

  return { addFieldToCollectionView, addFieldToDetailView };
}

commander.parse(process.argv);
if (process.argv.length < 3) {
  commander.help();
}
