const express = require('express');
const app = express();

const session = require('express-session');
const KnexSessionStore = require('connect-session-knex')(session);

const Knex = require('knex');
const knex = Knex({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    user: 'postgres',
    password: '',
    database: 'travis_ci_test'
  }
});

const store = new KnexSessionStore({
  knex: knex,
  tablename: 'sessions' // optional. Defaults to 'sessions'
});


app.use(session({
  secret: 'keyboard cat',
  cookie: {
    maxAge: 10000 // ten seconds, for testing
  },
  store: store
}));

var count = 0;

app.use('/', function (req, res, next) {
  var n = req.session.views || 0
  req.session.views = ++n
  res.end(n + ' views')
})

app.listen(3000);
