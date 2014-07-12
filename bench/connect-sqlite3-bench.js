var session = require('express-session')
var connect = require('connect')()
var SQLiteStore = require('./lib/connect-sqlite3.js')(session)
var connectionString = 'pg://grantminer:@localhost/session';

var Promise = require('bluebird')
var fs = require('fs')
var count = 10000
var i=0
var tasks = []

console.time('bench'+count)

store = Promise.promisifyAll(new SQLiteStore)

for (; i < count; i++) {
  tasks.push(store.setAsync('testsession'+i, {cookie: {maxAge:2000, expires: new Date()  }, name: 'sample name'}))
}

Promise.all(tasks, {concurrency: 1}).then(function() {
  console.timeEnd('bench'+count);
  process.exit();
})
