/**
 * MetaCrawler - API Gateway
 * -------------------------
 * This is the unified entry point for the entire platform.
 * It aggregates data from Python, Go, and Node.js services.
 * It exposes both REST and GraphQL endpoints.
 *
 * Usage:
 *   node index.js
 */

// const express = require('express');
// const { ApolloServer } = require('apollo-server-express');
// const resolvers = require('./resolvers');
// const typeDefs = require('./schema'); // You would define GraphQL schema here

// async function startServer() {
//   const app = express();
//   const server = new ApolloServer({ typeDefs, resolvers });
//   await server.start();
//   server.applyMiddleware({ app });

//   app.listen(4000, () => {
//     console.log('API Gateway running on http://localhost:4000');
//     console.log('GraphQL endpoint: http://localhost:4000/graphql');
//   });
// }

// startServer();
