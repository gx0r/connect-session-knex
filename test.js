'use strict';

var Promise = require('bluebird');
Promise.longStackTraces();

var test = require('tape');
var session = require('express-session');
var KnexStore = require('./index.js')(session);
var knexPg = require('knex')({
	client: 'pg',
	connection: {
		host: '127.0.0.1',
		user: 'postgres',
		password: '',
		database: 'travis_ci_test'
	}
});
var knexMysql = require('knex')({
	client: 'mysql',
	connection: {
		host: '127.0.0.1',
		user: 'travis',
		password: '',
		database: 'travis_ci_test'
	}
});


var stores = [];
stores.push(new KnexStore({db: ':memory:', dir: 'dbs'}));
stores.push(new KnexStore({ knex: knexPg }));
stores.push(new KnexStore({ knex: knexMysql }))

stores.forEach(function (store) {

	test('initial clear', function (t) {
		t.plan(3);
		store.clear(function(err, success) {
			t.error(err);

			store.length(function(err, len) {
				t.error(err, 'no error after clear');
				t.equal(len, 0, 'empty after clear');
			});
		})
	})

	test('set then clear', function (t) {
		t.plan(4);

		store.set('1092348234', {cookie: {maxAge: 1000}, name: 'InsertThenClear'})
		.then(function () {
			store.clear(function(err, cleared) {
				t.error(err);
				t.equal(1, cleared, 'cleared 1');

				store.length(function(err, len) {
					t.error(err, 'no error after clear');
					t.equal(len, 0, 'empty after clear');
				});
			})
		})
	})

	test('double clear', function (t) {
		t.plan(4);

		store.clear()
		.then(function () {
			return store.clear()
		})
		.then(function () {
			store.clear(function(err, cleared) {
				t.error(err);
				t.equal(0, cleared, 'cleared 0');

				store.length(function(err, len) {
					t.notOk(err, 'no error after clear');
					t.equal(len, 0, 'length');
				});
			})
		})
	})

	test('destroy', function (t) {
		t.plan(4);

		store.set('555666777', {cookie: {maxAge: 1000}, name: 'Rob Dobilina'}, function(err, rows) {
			t.error(err);
			if (rows.rowCount && rows.rowCount > 1) {
				t.fail('Row count too large');
			}

			store.destroy('555666777', function(err) {
				t.error(err);

				store.length(function(err, len) {
					t.error(err, 'error');
					t.equal(len, 0);
				});
			});
		});
	})

	test('set', function (t) {

		store.set('1111222233334444', {cookie: {maxAge: 20000}, name: 'sample name'}, function(err, rows) {
			t.error(err);
			if (rows.rowCount) {
				t.equal(rows.rowCount, 1, 'row count');
			}
			t.end();	
		});
	})

	test('retrieve', function (t) {
		t.plan(3);

		store.get('1111222233334444', function(err, session) {
			t.error(err);
			t.ok(session, 'session');
			t.deepEqual(session,{cookie: {maxAge: 20000 }, name: 'sample name'})
		})
	})

	test('unknown session', function (t) {
		t.plan(2);

		store.get('hope-and-change', function(err, rows) {
			t.error(err);
			t.equal(rows, undefined, 'unknown session is not undefined');
		})
	})

	test('only one session should exist', function (t) {
		t.plan(2);

		store.length(function(err, len) {
			t.error(err);
			t.equal(len, 1);
		});
	})

	test('cleanup', function (t) {
		store.knex.destroy().then(t.end);
	})	
})



