import { MikroORM } from '@mikro-orm/core';
import { __prod__ } from './constants';
import microConfig from './mikro-orm.config';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { HelloResolver } from './resolvers/hello';

const main = async () => {
  const orm = await MikroORM.init(microConfig);
  await orm.getMigrator().up();

  const app = express();
  const appolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver],
      validate: false,
    }),
    context: () => ({ em: orm.em }),
  });

  await appolloServer.start();

  appolloServer.applyMiddleware({ app });
  app.listen(4000, () => console.log('app listen to localhost:4000'));
};

main().catch((err) => {
  console.log(err);
});
