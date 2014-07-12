var session = require('express-session')
var KnexStore = require('../lib/connect-session-knex.js')(session)
var knex = require('knex')({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    user: 'session',
    database: 'session'
  }
})

var Promise = require('bluebird')
var fs = require('fs')
var count = 10000
var i=0
var tasks = []

knex.schema.dropTableIfExists('sessions').then(function () {


  store = new KnexStore({
    knex: knex
  })

  console.time('bench'+count)


  for (; i < count; i++) {
    tasks.push(store.set('testsession'+i, {cookie: {maxAge:2000, expires: new Date() }, name: 'sample name'}))
  }

  Promise.all(tasks, {concurrency: 1}).then(function() {
    console.timeEnd('bench'+count);
    process.exit();
  })


})
