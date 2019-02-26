#!/usr/bin/env node
// * redez-server

const commander = require('commander');

const start = require('./commands/start');
const parse = require('./commands/parse');

const init = require('./init/init');

// ** Constants
const DESCRIPTION = 'Easily generate endpoints for Apollo Server along with React components that retrieve and display the data';

// ** Command Structure
commander
  .version('0.0.1')
  .description(DESCRIPTION);

commander.command('start')
  .alias('s')
  .description('Start the editor in the current project')
  .action(runCommand(start));

commander.command('parse <file>')
  .alias('p')
  .description('Parse the given file into an AST using babel')
  .action(parse);

commander.command('*', { noHelp: true })
  .action(() => {
    commander.help();
  });

function runCommand(command) {
  return async () => {
    const config = await init();
    await command(config);
  };
}

commander.parse(process.argv);
