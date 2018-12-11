const inquirer = require('inquirer');

// ** Generate Command
export default async function generate(config) {
  const output = Object.assign({}, config);
  const { resources } = await addResource();
  output.resources = resources;
  console.log(output);
}

/**
 * Add a resource by adding a type to the generated schema
 * and generating any necessary views (React components)
 */
async function addResource() {
  const resources = [];
  const resource = {};

  const {
    resourceName,
  } = await inquirer.prompt([
    {
      name: 'resourceName',
      type: 'input',
      message: 'What is the name of your new resource? (singular form)',
    },
  ]);
  resource.name = resourceName;

  resource.fields = await resourceFieldPromptLoop(resourceName, resources);
  resource.views = await getViewInput(resource.fields);

  resources.push(resource);

  console.log('Resource created! \n');

  return { resources, resourceName };
}

// *** Add fields
/**
* Prompt the user to enter new field information
* until they choose to stop
*/
async function resourceFieldPromptLoop(resourceName, resources) {
  console.log('\n');
  console.log(`What fields does a ${resourceName} have?`);
  console.log('An id field has already been added for you.');

  const fields = [{
    name: 'id',
    type: 'ID!',
  }];

  let addNextField = true;

  while (addNextField) {
    console.log('\n');

    const fieldData = {
      name: await fieldNamePrompt(),
      type: await fieldTypePrompt(resources),
    };

    fields.push(fieldData);

    addNextField = await nextFieldPrompt(fields.length);
  }

  console.log('\n');

  return fields;
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

async function fieldTypePrompt(resourceList) {
  const choices = [
    'Int',
    'Float',
    'String',
    'Boolean',
    'ID',
    'List',
    'Resource',
  ];

  let { fieldType } = await inquirer.prompt([{
    name: 'fieldType',
    type: 'list',
    choices,
    default: 0,
    message: 'Choose the field type',
  }]);

  const list = fieldType === 'List';
  let nullable = false;

  if (list) {
    ({ fieldType } = await inquirer.prompt([{
      name: 'fieldType',
      type: 'list',
      choices: choices.filter(choice => choice !== 'List'),
      default: 0,
      message: 'Choose the list type',
    }]));
  } else {
    nullable = await inquirer.prompt([{
      name: 'nullable',
      type: 'confirm',
      message: 'Is this field nullable?',
    }]);
  }

  if (fieldType === 'Resource') {
    const { resources, resourceName } = await addResource();
    resources.forEach(r => resourceList.push(r));

    fieldType = resourceName;
  }

  if (list) {
    fieldType = `[${fieldType}]`;
  }

  if (nullable) {
    fieldType += '!';
  }

  return fieldType.trim();
}


// *** View input
/**
* Determine which views should be generated,
* which fields should be displayed in those views,
* and which fields should be used as query params for each view
*/
async function getViewInput(fields) {
  const views = {};

  // eslint-disable-next-line
  for (const viewType of VIEW_TYPES) {
    const {
      shouldGenerateView,
    } = await inquirer.prompt([
      {
        name: 'shouldGenerateView',
        type: 'confirm',
        message: `Do you want a ${viewType} view for your new resource?`,
      },
    ]);

    if (shouldGenerateView) {
      views[viewType] = {};

      const { viewFieldNames } = await inquirer.prompt([
        {
          name: 'viewFieldNames',
          type: 'checkbox',
          message: `Which fields should be included in the ${viewType} view?`,
          choices: fields.map(f => f.name),
        },
      ]);

      views[viewType].fields = fields.filter(f => viewFieldNames.includes(f.name));
    }
  }

  return views;
}
