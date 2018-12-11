const inquirer = require('inquirer');
const graphql = require('graphql');

const GRAPHQL_FIELD_TYPES = {
  Int: graphql.GraphQLInt,
  Float: graphql.GraphQLFloat,
  String: graphql.GraphQLString,
  Boolean: graphql.GraphQLBoolean,
  ID: graphql.GraphQLID,
};

const VIEW_TYPES = ['list', 'detail'];


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
  const {
    resourceName,
  } = await inquirer.prompt([
    {
      name: 'resourceName',
      type: 'input',
      message: 'What is the name of your new resource? (singular form)',
    },
  ]);


  const resources = [];
  const fields = await resourceFieldPromptLoop(resourceName, resources);

  const resource = {};
  resource.name = resourceName;
  resource.type = graphql.GraphQLObjectType({
    name: resourceName,
    fields,
  });


  const fieldNames = Object.keys(resource.fields);
  resource.views = await getViewInput(fieldNames);

  resources.push(resource);

  console.log('Resource created! \n');

  return { resources, resource };
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

  const fieldTypes = {
    id: { type: graphql.GraphQLID, nullable: false },
  };

  let addNextField = true;

  while (addNextField) {
    console.log('\n');

    const name = await fieldNamePrompt();
    const type = await fieldTypePrompt(resources);
    fieldTypes[name] = type;

    addNextField = await nextFieldPrompt(fieldTypes.length);
  }

  console.log('\n');

  return fieldTypes;
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
  const choices = [...Object.keys(GRAPHQL_FIELD_TYPES), 'Resource'];

  const { typeName } = await inquirer.prompt([{
    name: 'fieldType',
    type: 'list',
    choices,
    default: 0,
    message: 'Choose the field type',
  }]);

  let fieldType = GRAPHQL_FIELD_TYPES[typeName];

  const list = typeName === 'List';

  if (list) {
    const { listType } = await inquirer.prompt([{
      name: 'listType',
      type: 'list',
      choices: choices.filter(choice => choice !== 'List'),
      default: 0,
      message: 'Choose the list type',
    }]);

    fieldType = graphql.GraphQLList(GRAPHQL_FIELD_TYPES[listType]);
  } else {
    const nonNull = await inquirer.prompt([{
      name: 'nullable',
      type: 'confirm',
      message: 'Is this field required to be non-null?',
    }]);

    if (nonNull) {
      fieldType = graphql.GraphQLNonNull(fieldType);
    }
  }

  if (fieldType === 'Resource') {
    const { resources, resource } = await addResource();
    resources.forEach(r => resourceList.push(r));

    fieldType = resource.type;
  }

  return fieldType;
}


// *** View input
/**
* Determine which views should be generated,
* which fields should be displayed in those views,
* and which fields should be used as query params for each view
*/
async function getViewInput(fieldNames) {
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
          choices: fieldNames,
        },
      ]);

      views[viewType].fieldNames = fieldNames.filter(f => viewFieldNames.includes(f.name));
    }
  }

  return views;
}
