// ** Start Command
const { ApolloServer, gql } = require('apollo-server');

async function start(config) {
  await startServer();

  async function startServer() {
    // ** GraphQL Schema
    const typeDefs = gql`
      type ComponentTree {
        id: ID!
        data: String!
      }

      type Query {
        generateComponentTrees: [ComponentTree]
      }`;

    // ** Resolvers

    const resolvers = {
      Query: {
        generateComponentTrees() {
          return config.componentTrees;
        },
      },
      ComponentTree: {
        data(component) {
          return component.data;
        },
      },
    };

    const server = new ApolloServer({ typeDefs, resolvers });
    const { url } = await server.listen();
    console.log(`🚀  Redez Server ready at ${url}`);
  }
}

module.exports = start;
