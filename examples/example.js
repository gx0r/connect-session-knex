/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */

const express = require("express");

const app = express(); // Express 4
const session = require("express-session");
const KnexSessionStore = require("connect-session-knex")(session);

const store = new KnexSessionStore(/* options here */); // defaults to a sqlite3 database

app.use(
  session({
    secret: "keyboard cat",
    cookie: {
      maxAge: 30000, // 30 seconds for testing
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
