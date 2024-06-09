import express from "express";
import session from "express-session";
import { ConnectSessionKnexStore } from "../lib/index.mjs";
import Knex from "knex";

const app = express();

const knex = Knex({
  client: "pg",
  connection: {
    host: "127.0.0.1",
    user: "postgres",
    password: "",
    database: "travis_ci_test",
  },
});

const store = new ConnectSessionKnexStore({
  knex,
  tablename: "sessions", // optional. Defaults to 'sessions'
});

app.use(
  session({
    secret: "keyboard cat",
    cookie: {
      maxAge: 10000, // ten seconds, for testing
    },
    store,
  }),
);

app.use("/", (req, res) => {
  const n = req.session.views || 0;
  req.session.views = n + 1;
  res.end(`${n} views`);
});

app.listen(3000);

setInterval(() => {
  store.length().then((length) => {
    console.log(`There are ${JSON.stringify(length)} sessions`);
  });
}, 2000);

setInterval(() => {
  store.clear().then((length) => {
    console.log(`Cleared ${JSON.stringify(length)} sessions`);
  });
}, 30000);
