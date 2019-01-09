// ** Start Command
const { ApolloServer, gql } = require('apollo-server');
const { generateComponentTrees } = require('../componentTreeGenerator.js');

async function start(config) {
  const componentTrees = await generateComponentTrees(config);
  await startServer();

  async function startServer() {
    // ** GraphQL Schema
    const typeDefs = gql`
      type Component {
        id: ID!
        componentCode: String!
        children: [Component]
      }

      type Query {
        generateComponentTrees: [Component]
        getComponent: Component
      }`;

    // ** Resolvers

    const resolvers = {
      Query: {
        generateComponentTrees() {
          return componentTrees;
        },
      },
      Component: {
        children(component) {
          return component.children;
        },
      },
    };

    console.log(`Starting server with config: ${JSON.stringify(config)}`);
    console.log('\n');
    const server = new ApolloServer({ typeDefs, resolvers });
    const { url } = await server.listen();
    console.log(`🚀  Redez Server ready at ${url}`);
  }
}

module.exports = start;
