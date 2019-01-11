const babelParser = require('@babel/parser');
const beautify = require('js-beautify').js;
const {
  clone, flatten, find, findIndex,
} = require('lodash');

const path = require('path');
const fs = require('fs');
const util = require('util');

const exists = util.promisify(fs.exists);
const readfile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

/**
* Generate a component tree for the root component of the target app (the entry point),
* and then generate component trees for any components in the app's src directory that were not
* included in any previously generated trees
*
* @param {string} The absolute path to the source directory
* of the target app where all components should reside
*
* @returns {Array} An array of component trees
*/
async function generateComponentTrees(config) {
  const validRootComponent = await fileIsComponent(config.rootComponentPath);
  if (!validRootComponent) {
    console.error('Cannot recognize given root component as a React component');
    process.exit();
  }

  const componentPathToTree = {};

  const [
    rootComponentTree,
    allComponentPaths,
  ] = await Promise.all([
    generateComponentTree(config.rootComponentPath, config, componentPathToTree),
    getComponentPathsInProjectSrc(config),
  ]);

  const trees = [rootComponentTree];

  for (let i = 0; i < allComponentPaths.length; i += 1) {
    const componentPath = allComponentPaths[i];
    if (!(componentPath in componentPathToTree)) {
      const componentTree = await generateComponentTree(componentPath, config, componentPathToTree);
      componentPathToTree[componentTree.path] = componentTree;

      trees.push(componentTree);
    }
  }

  return trees;
}

async function generateComponentTree(componentPath, config, componentPathToTree) {
  try {
    const AST = await getFileAST(componentPath);
    const componentName = path.basename(componentPath).split('.')[0];
    logAST(componentName, AST, config);

    const childPaths = await getChildComponentPaths(AST, componentPath);

    const tree = {
      path: componentPath,
      name: componentName,
      ast: AST,
      children: await Promise.all(
        childPaths.map(childPath => generateComponentTree(
          childPath,
          config,
          componentPathToTree,
        )),
      ),
    };

    // eslint-disable-next-line
    componentPathToTree[tree.path] = tree;

    return tree;
  } catch (err) {
    console.error(err);
    throw new Error(`Error parsing component at ${componentPath}`);
  }
}

async function getFileAST(filePath) {
  // TODO Use memoization to store component ASTs for later use
  const code = await readfile(filePath, 'utf8');

  return babelParser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx'],
  });
}

async function getComponentPathsInProjectSrc(config) {
  try {
    return await getComponentPathsInDirectory(config.srcPath);
  } catch (err) {
    console.error(err);
    throw new Error(`Error reading source directory: ${config.srcPath}`);
  }
}

async function getComponentPathsInDirectory(dirPath) {
  const files = await readdir(dirPath);
  const filePaths = files.map(fileName => path.join(dirPath, fileName));
  const fileMetadata = await Promise.all(filePaths.map(async (filePath) => {
    const stats = await stat(filePath);
    stats.path = filePath;
    return stats;
  }));

  const fetchPathsFromSubdirectories = Promise.all(fileMetadata
    .filter(meta => meta.isDirectory())
    .map(meta => getComponentPathsInDirectory(meta.path)));

  const flagComponentsInCurrentDirectory = Promise.all(fileMetadata
    .filter(meta => !meta.isDirectory())
    .map(async (meta) => {
      const updated = clone(meta);
      updated.isComponent = await fileIsComponent(meta.path);
      return updated;
    }));

  const [pathsFromSubdirs, updatedFileMetadata] = await Promise.all([
    fetchPathsFromSubdirectories,
    flagComponentsInCurrentDirectory,
  ]);

  return [
    ...flatten(pathsFromSubdirs),
    ...updatedFileMetadata.filter(meta => meta.isComponent).map(meta => meta.path),
  ];
}

async function fileIsComponent(filePath) {
  const ext = getFileExt(filePath);

  if (ext !== 'js' && ext !== 'jsx') {
    return false;
  }

  try {
    const AST = await getFileAST(filePath);

    const defaultExportDeclaration = getDefaultExportDeclaration(AST.program.body);
    const renderBlock = getComponentRenderBlock(defaultExportDeclaration);
    const returnStatement = find(renderBlock.body, node => node.type === 'ReturnStatement');

    return returnStatement.argument && returnStatement.argument.type === 'JSXElement';
  } catch (err) {
    return false;
  }
}

function getFileExt(filePath) {
  const splitName = path.basename(filePath).split('.');
  if (splitName.length < 2) {
    return null;
  }

  return splitName[splitName.length - 1];
}

async function logAST(componentName, ast, config) {
  const logPath = path.join(config.clientPath, path.join('.redez', 'logs'));
  const ASTLogPath = path.join(logPath, 'componentASTs');

  if (!fs.existsSync(logPath)) {
    await mkdir(logPath);
    await mkdir(ASTLogPath);
  } else if (!fs.existsSync(ASTLogPath)) {
    await mkdir(ASTLogPath);
  }

  const ASTBuffer = beautify(JSON.stringify(ast));
  writeFile(path.join(ASTLogPath, `${componentName}.json`), ASTBuffer);
}

async function getChildComponentPaths(AST, componentPath) {
  const fileBody = AST.program.body;
  const componentDeclaration = getDefaultExportDeclaration(fileBody);

  const potentiallyRenderedElements = getPotentiallyRenderedElements(componentDeclaration);
  const renderedElementNames = {};
  potentiallyRenderedElements.forEach((elem) => {
    renderedElementNames[elem.openingElement.name.name] = true;
  });

  const localImports = getLocalImports(fileBody);
  const childComponentPaths = [];

  for (let i = 0; i < localImports.length; i += 1) {
    const importDeclaration = localImports[i];

    // We expect single file component, so they will be imported using a default specifier
    const defaultSpecifier = find(importDeclaration.specifiers, (specifier => specifier.type === 'ImportDefaultSpecifier'));
    if (defaultSpecifier && defaultSpecifier.local.name in renderedElementNames) {
      const importSourcePath = importDeclaration.source.value;
      const ext = getFileExt(importSourcePath);

      const childPath = path.resolve(path.dirname(componentPath), importSourcePath);

      // Component imports often leave off the file extension
      // Check for a file with either a js or jsx extension
      if (!ext) {
        const jsFilePath = `${childPath}.js`;
        const jsxFilePath = `${childPath}.jsx`;

        const [jsFileExists, jsxFileExists] = await Promise.all([
          exists(jsFilePath),
          exists(jsxFilePath),
        ]);

        if (jsFileExists) {
          childComponentPaths.push(jsFilePath);
        } else if (jsxFileExists) {
          childComponentPaths.push(jsxFilePath);
        }
      } else {
        const fileExists = await exists(childPath);
        if (fileExists) {
          childComponentPaths.push(childPath);
        }
      }
    }
  }

  return childComponentPaths;
}

function getDefaultExportDeclaration(fileBody) {
  const defaultExportDeclarationIndex = findIndex(fileBody, (node => node.type === 'ExportDefaultDeclaration'));
  if (defaultExportDeclarationIndex === -1) {
    throw new Error('Cannot get a default export from block with no ExportDefaultDeclaration node');
  }

  const defaultExportDeclaration = fileBody[defaultExportDeclarationIndex];
  const id = defaultExportDeclaration.declaration.name;

  const bodyBeforeExport = fileBody.slice(0, defaultExportDeclarationIndex);
  return findDeclaration(bodyBeforeExport, id);
}

/**
* @param {body} the block to search for the declaration
* @param {id} the id of the declaration to look for
* @returns {object} returns a declaration with the given id
*/
function findDeclaration(body, idName) {
  for (let i = body.length - 1; i > 0; i -= 1) {
    const node = body[i];
    if (node.declarations) {
      for (let j = 0; j < node.declarations.length; j += 1) {
        if (node.declarations[j].id.name === idName) {
          return node;
        }
      }
    } else if (node.id) {
      if (node.id.name === idName) {
        return node;
      }
    }
  }

  return null;
}

/**
* @param {object} a ClassDeclaration, FunctionDeclaration, or VariableDeclaration
* @returns {Array} The every jsx element that might be rendered directly
* by the declared component, including other components
*/
function getPotentiallyRenderedElements(componentDeclaration) {
  /*
    FIXME Come up with a more precise way to determine
    which Components are potentially rendered by this one.
    The current method assumes that the component body will
    contain a single return statement with jsx as an argument.
    References to variables containing jsx and conditional returns will not be parsed properly
  */
  const renderBlock = getComponentRenderBlock(componentDeclaration);
  const returnStatement = find(renderBlock.body, node => node.type === 'ReturnStatement');
  const rootElement = returnStatement.argument;

  if (!rootElement) {
    throw new Error('Expected component render block to directly return JSX');
  }

  if (returnStatement.argument.type !== 'JSXElement') {
    throw new Error('Expected component render block to directly return JSX');
  }

  return flattenJSXTree(returnStatement.argument);
}

/**
  * @param {object} the ClassDeclaration, FunctionDeclaration, or VariableDeclaration
  * @returns {object} the BlockStatement that defines the component's render function
  */
function getComponentRenderBlock(componentDeclaration) {
  switch (componentDeclaration.type) {
    case 'ClassDeclaration':
      return getRenderBlockFromClassDeclaration(componentDeclaration);
    case 'FunctionDeclaration':
      return getRenderBlockFromFunctionDeclaration(componentDeclaration);
    case 'VariableDeclaration':
      return getRenderBlockFromVariableDeclaration(componentDeclaration);
    default:
      return null;
  }
}

function getRenderBlockFromClassDeclaration(componentDeclaration) {
  const classBody = componentDeclaration.body;
  const renderMethods = classBody.body.filter(node => node.type === 'ClassMethod' && node.key.name === 'render');
  if (renderMethods.length !== 1) {
    throw new Error('Expected render method in component class');
  }

  return renderMethods[0].body;
}

function getRenderBlockFromFunctionDeclaration(componentDeclaration) {
  if (componentDeclaration.params > 1) {
    throw new Error('Expected a pure component to take 0 or 1 parameters');
  }

  return componentDeclaration.body;
}

function getRenderBlockFromVariableDeclaration(componentDeclaration) {
  const declarators = componentDeclaration.declarations.filter(d => d.type === 'VariableDeclarator');
  if (declarators.length !== 1) {
    throw new Error('Expected component declaration to have a single VariableDeclarator if it is a VariableDeclaration');
  }
  return declarators[0].init.body;
}

function flattenJSXTree(node) {
  const allElements = [];
  if (node.type === 'JSXElement') {
    allElements.push(node);

    node.children.forEach((child) => {
      allElements.push(...flattenJSXTree(child));
    });
  }


  return allElements;
}

/**
* @param {Array<ASTNode>} The AST body to search
* @returns {Array<ASTNode>} ImportDeclaration nodes that import from a relative path
*/
function getLocalImports(fileBody) {
  // FIXME Support projects configured to use absolute imports and aliases
  return fileBody.filter(node => (
    node.type === 'ImportDeclaration'
    && node.source
    && node.source.value.length > 0
    && node.source.value[0] === '.'
  ));
}

module.exports = {
  generateComponentTrees,
  generateComponentTree,
  getFileAST,
  getComponentPathsInProjectSrc,
  getComponentPathsInDirectory,
  getFileExt,
  fileIsComponent,
  getChildComponentPaths,
  getDefaultExportDeclaration,
  findDeclaration,
  getPotentiallyRenderedElements,
  getComponentRenderBlock,
  flattenJSXTree,
  getLocalImports,
};
