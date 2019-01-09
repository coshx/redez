# Redez Server
Easily generate endpoints for Apollo Server along with React components that retrieve and display the data

# Usage

# Development
## Run locally
`cd react-apollo-magic-glue`

`npm link`

Run the generate command inside an Apollo project
`react-apollo-magic-glue g`

## Project Structure
 - `index.js` defines all possible commands that can be run
 - `/commands` contains all command definitions
 - `/templates` contains all templates that are used by the tool to generate code
 - `schemaGenerator.js` - takes in the answers recorded by the CLI and outputs a GraphQL schema into the server project
 - `reactComponentGenerator.js` - takes in the answers recorded by the CLI and outputs React components into the client project`
 
## Configuration Files
 - All of the configuration data resides in the `react-apollo-magic-glue-server-cfg.json` file in the user's server directory root (is there a more user friendly way to store this?). This file is generated if it is not found in the current git repository or current directory where the command is run.
 - The configuration file in the client project simply points to the server project and contains no actual configuration (would it be possible to automatically link the two configuration files so that editing one edits the other?)
 
Config format:
```javascript
{
  serverPath: String //relative path from the config file to the server project root
  clientPath: String //relative path from the config file to the client project root
  componentPath: String //The path relative to the client project root where React components should be generated
  generateCSSModules: Bool //Whether to generate CSS modules alongside the React components
}
```

## Commands
Each command builds upon the configuration data based on user input and outputs the final javascript object to other modules which are responsible for actually altering the user's Apollo project

### generate
Used to generate a new resource which will be automatically added to the GraphQL schema and displayed by the generated React components

Output format:
```javascript
{
  resources: [Resource] //An array of resources that were requested by the command
}

//Resource
{ 
  name: String
  type: [GraphQLObjectType]
  views: { //There will be a key in this object for each view (React component) that should be generated
    viewType: [String] //Each key has an array of field names that should be included in the view
  }
}
```
(Probably beneficial to use typescript here so that this does not need documentation)
