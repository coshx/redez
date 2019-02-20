# Redez
A visual editor for React components

# Usage


# Development
## Run locally
`cd redez`

`npm link`

Run the start command inside a React project
`redez start`

## Project Structure
 - `index.js` defines all possible commands that can be run
 - `/commands` contains all command definitions
 - `/init` initializes redez by loading configuration files and starting the editor in the target project
 - `componentTreeGenerator.js` - generates component trees from the target project
 
## Configuration Files
 - All of the configuration data resides in the `.redez` directories in the target projects
 
Config format:
```javascript
{
  serverPath: String // relative path from the config file to the server project root
  clientPath: String // relative path from the config file to the client project root
  srcPath: String // relative path from the client project to the source code directory 
  rootComponentPath: String // relative path from the source code directory to the root component of the App
}
```
