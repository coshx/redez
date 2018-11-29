#!/usr/bin/env node

const DESCRIPTION = 'Easily generate endpoints for Apollo Server along with React components that retrieve and display the data';

const commander = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
// const shell = require('shelljs');

commander
  .version('0.0.1')
  .description(DESCRIPTION);

function welcome() {
  console.log('\n');
  console.log(chalk.green('react-apollo-scaffold'));
  console.log(DESCRIPTION);
  console.log('\n');
}

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

  const { resourceName } = await resourceNamePrompt();

  const {
    shouldGenerateCollectionView,
    shouldGenerateDetailView,
  } = await desiredViewsPrompt();

  const output = {
    name: resourceName,
  };

  if (shouldGenerateDetailView) {
    output.detailViewFields = [];
  }

  if (shouldGenerateCollectionView) {
    output.collectionViewFields = [];
  }

  await resourceFieldPromptLoop(output);

  console.log(output);
}

function resourceNamePrompt() {
  const questions = [
    {
      name: 'resourceName',
      type: 'input',
      message: 'What is the name of your new resource? (singular form)',
    },
  ];

  return inquirer.prompt(questions);
}

function desiredViewsPrompt() {
  const questions = [
    {
      name: 'shouldGenerateCollectionView',
      type: 'confirm',
      message: 'Do you want a collection view for your new resource?',
    },
    {
      name: 'shouldGenerateDetailView',
      type: 'confirm',
      message: 'Do you want a detail view for your new resource?',
    },
  ];

  return inquirer.prompt(questions);
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
