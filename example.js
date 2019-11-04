const express = require("express"); // Express 4
const app = express();

const session = require("express-session");
const KnexSessionStore = require("connect-session-knex")(session);
const store = new KnexSessionStore(/* options here */); // defaults to a sqlite3 database

app.use(
  session({
    secret: "keyboard cat",
    cookie: {
      maxAge: 30000 // 30 seconds for testing
    },
    store: store
  })
);

var count = 0;

app.use("/", function(req, res, next) {
  var n = req.session.views || 0;
  req.session.views = ++n;
  res.end(n + " views");
});

app.listen(3000);

setInterval(function() {
  store.length().then(function(length) {
    console.log("There are " + JSON.stringify(length) + " sessions");
  });
}, 2000);

setInterval(function() {
  store.clear().then(function(length) {
    console.log("Cleared " + JSON.stringify(length) + " sessions");
  });
}, 30000);
