var session = require('express-session')
var KnexStore = require('../lib/connect-session-knex.js')(session)
var Promise = require('bluebird')
var fs = require('fs')
var count = 10000
var i=0
var tasks = []
var dbfile = 'connect-session-knex.sqlite'

if (fs.exists(dbfile))
  fs.unlinkSync(dbfile)

console.time('bench'+count)

store = new KnexStore()

for (; i < count; i++) {
  tasks.push(store.set('testsession'+i, {cookie: {maxAge:2000}, name: 'sample name'}))
}

Promise.all(tasks).then(function() {
  console.timeEnd('bench'+count);
  process.exit();
})
