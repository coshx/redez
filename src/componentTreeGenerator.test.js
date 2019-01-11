const path = require('path');
const { find } = require('lodash');

const {
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
} = require('./componentTreeGenerator.js');

const testConfig = {
  clientPath: path.resolve('./test-input'),
  srcPath: path.resolve('./test-input/src'),
  rootComponentPath: path.resolve('./test-input/src/App.jsx'),
};

let rootAST;
let pureComponentAST;
let anonComponentAST;

let classComponentDeclaration;
let pureComponentDeclaration;
let anonComponentDeclaration;

beforeAll(async () => {
  rootAST = await getFileAST(testConfig.rootComponentPath);
  classComponentDeclaration = find(rootAST.program.body, node => node.type === 'ClassDeclaration');

  pureComponentAST = await getFileAST(path.resolve(testConfig.srcPath, './components/TestPureComponent.jsx'));
  pureComponentDeclaration = find(pureComponentAST.program.body, node => node.type === 'FunctionDeclaration');

  anonComponentAST = await getFileAST(path.resolve(testConfig.srcPath, './components/TestAnonComponent.jsx'));
  anonComponentDeclaration = find(anonComponentAST.program.body, node => node.type === 'VariableDeclaration');
});

describe('componentTreeGenerator', () => {
  describe('generateComponentTrees', () => {
    test('returns an array containing all component trees in the given srcDir', async () => {
      const componentTrees = await generateComponentTrees(testConfig);
      expect(componentTrees.length).toBe(1);
    });
  });

  describe('generateComponentTree', () => {
    test('returns the tree of components starting from the given component', async () => {
      const componentTree = await generateComponentTree(
        testConfig.rootComponentPath,
        testConfig,
        {},
      );
      expect(componentTree.name).toBe('App');

      const firstLevel = componentTree.children;
      expect(firstLevel[0].name).toBe('TestClassComponent');
      expect(firstLevel[1].name).toBe('TestPureComponent');
      expect(firstLevel[2].name).toBe('TestAnonComponent');

      expect(firstLevel[1].children[0].name).toBe('TestClassComponent');
    });
  });

  describe('getComponentPathsInProjectSrc', () => {
    test("returns a list of all paths in the project's source directory that point to React component files", async () => {
      const componentPaths = await getComponentPathsInProjectSrc(testConfig);
      expect(componentPaths).toEqual(expect.arrayContaining([
        path.resolve(testConfig.srcPath, './App.jsx'),
        path.resolve(testConfig.srcPath, './components/TestClassComponent.js'),
        path.resolve(testConfig.srcPath, './components/TestPureComponent.jsx'),
        path.resolve(testConfig.srcPath, './components/TestAnonComponent.jsx'),
      ]));
    });
  });

  describe('getComponentPathsInDirectory', () => {
    test('returns a list of all paths in the given directory that point to React component files', async () => {
      const componentPaths = await getComponentPathsInDirectory(path.resolve(testConfig.srcPath));
      expect(componentPaths).toEqual(expect.arrayContaining([
        path.resolve(testConfig.srcPath, './App.jsx'),
        path.resolve(testConfig.srcPath, './components/TestClassComponent.js'),
        path.resolve(testConfig.srcPath, './components/TestPureComponent.jsx'),
        path.resolve(testConfig.srcPath, './components/TestAnonComponent.jsx'),
      ]));
    });
  });

  describe('fileIsComponent', () => {
    test('Correctly determines whether the given file is a React component', async () => {
      expect(await fileIsComponent(path.resolve(testConfig.srcPath, './components/TestClassComponent.js'))).toBe(true);
      expect(await fileIsComponent(path.resolve(testConfig.srcPath, './components/TestPureComponent.jsx'))).toBe(true);
      expect(await fileIsComponent(path.resolve(testConfig.srcPath, './components/TestAnonComponent.jsx'))).toBe(true);
      expect(await fileIsComponent(path.resolve(testConfig.srcPath, './helpers/TestHelper.js'))).toBe(false);
    });
  });

  describe('getFileExt', () => {
    test('returns the file extension if the file at the given path', () => {
      expect(getFileExt('../test-input/src/App.jsx')).toBe('jsx');
    });

    test('returns null if the file / directory at the given path does not have an extension', () => {
      expect(getFileExt('../test-input/file')).toBe(null);
    });
  });

  describe('getChildComponentPaths', async () => {
    test('returns an array of paths to all components that might be rendered by the component represented by the given AST', async () => {
      let childPaths = await getChildComponentPaths(rootAST, testConfig.rootComponentPath);
      expect(childPaths).toEqual(expect.arrayContaining([
        path.resolve(testConfig.srcPath, './components/TestClassComponent.js'),
        path.resolve(testConfig.srcPath, './components/TestPureComponent.jsx'),
        path.resolve(testConfig.srcPath, './components/TestAnonComponent.jsx'),
      ]));

      childPaths = await getChildComponentPaths(pureComponentAST, path.resolve(testConfig.srcPath, './components/TestPureComponent.jsx'));
      expect(childPaths).toEqual(expect.arrayContaining([
        path.resolve(testConfig.srcPath, './components/TestClassComponent.js'),
      ]));
    });
  });

  describe('getDefaultExportDeclaration', () => {
    test('Finds export default within the given code body and then returns the declaration of the class being exported', () => {
      let exportedDeclaration = getDefaultExportDeclaration(rootAST.program.body);
      expect(exportedDeclaration).toEqual(classComponentDeclaration);

      exportedDeclaration = getDefaultExportDeclaration(pureComponentAST.program.body);
      expect(exportedDeclaration).toEqual(pureComponentDeclaration);

      exportedDeclaration = getDefaultExportDeclaration(anonComponentAST.program.body);
      expect(exportedDeclaration).toEqual(anonComponentDeclaration);
    });
  });

  describe('findDeclaration', () => {
    test('Returns declaration within the given code body with the given id', () => {
      expect(findDeclaration(rootAST.program.body, 'App')).not.toBe(null);
      expect(findDeclaration(rootAST.program.body, 'OtherID')).toBe(null);
      expect(findDeclaration(anonComponentAST.program.body, 'TestAnonComponent')).not.toBe(null);
    });
  });

  describe('getPotentiallyRenderedElements', () => {
    test('Returns all jsx elements that could be rendered by the given component', () => {
      const elementNames = getPotentiallyRenderedElements(classComponentDeclaration)
        .map(elem => elem.openingElement.name.name);
      expect(elementNames)
        .toEqual(expect.arrayContaining([
          'div',
          'div',
          'div',
          'TestClassComponent',
          'TestPureComponent',
          'TestAnonComponent',
        ]));
    });
  });

  describe('getComponentRenderBlock', () => {
    test('Returns the render method block for a class based component declaration', () => {
      const renderBlock = find(classComponentDeclaration.body.body, node => node.type === 'ClassMethod' && node.key.name === 'render').body;
      expect(getComponentRenderBlock(classComponentDeclaration)).toEqual(renderBlock);
    });

    test('Returns the render method block for a component declared with a function declaration', () => {
      const renderBlock = pureComponentDeclaration.body;
      expect(getComponentRenderBlock(pureComponentDeclaration)).toEqual(renderBlock);
    });

    test('Returns the render method block for a component declared with an anonymous function', () => {
      const renderBlock = find(anonComponentDeclaration.declarations, dec => dec.type === 'VariableDeclarator').init.body;
      expect(getComponentRenderBlock(anonComponentDeclaration)).toEqual(renderBlock);
    });
  });

  describe('flattenJSXTree', () => {
    test('Returns an array of all jsx elements within the current tree, including the root element', () => {
      const classBody = classComponentDeclaration.body;

      const renderMethod = find(classBody.body, node => node.type === 'ClassMethod' && node.key.name === 'render');
      const returnStatement = find(renderMethod.body.body, node => node.type === 'ReturnStatement');

      const jsxRoot = returnStatement.argument;
      const flattenedTree = flattenJSXTree(jsxRoot);

      const elementNames = flattenedTree.map(elem => elem.openingElement.name.name);

      expect(elementNames).toEqual(expect.arrayContaining([
        'div',
        'div',
        'div',
        'TestClassComponent',
        'TestPureComponent',
        'TestAnonComponent',
      ]));
    });
  });

  describe('getLocalImports', () => {
    test('Returns an array of all ImportDeclration nodes in the given code body that use a relative path as their source', () => {
      const rootImports = getLocalImports(rootAST.program.body);
      const sources = rootImports.map(declaration => declaration.source.value);
      expect(sources).toEqual(expect.arrayContaining([
        './components/TestClassComponent',
        './components/TestPureComponent',
        './components/TestAnonComponent',
        './helpers/TestHelper',
      ]));
    });
  });
});
