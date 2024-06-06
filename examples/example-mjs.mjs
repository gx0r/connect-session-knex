import express from "express";
import session from "express-session";
import ConnectSessionKnex from "../lib/index.mjs";
const KnexSessionStore = ConnectSessionKnex(session);

const app = express(); // Express 4
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
