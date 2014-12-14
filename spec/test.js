'use strict';
/* global describe, before, after, it */
var should = require('should'),
session = require('express-session');

var KnexStore = require('../lib/connect-session-knex.js')(session);

var sqliteStore = new KnexStore({db: ':memory:', dir: 'dbs'});

// var knexPg = require('knex')({
// 	client: 'pg',
// 	connection: {
// 		host: '127.0.0.1',
// 		user: 'session',
// 		password: 'session',
// 		database: 'session'
// 	}
// });

var knexPg = require('knex')({
	client: 'pg',
	connection: {
		host: '127.0.0.1',
		user: 'postgres',
		password: '',
		database: 'travis_ci_test'
	}
});

var postgresStore = new KnexStore({ knex: knexPg });

describe('connect-session-knex sqlite3 test suite', function() {
	before(function() {
		// this.store = new KnexStore({db: ':memory:', dir: 'dbs'});
		this.store = sqliteStore;
	});

	after(function() {
		// this.store.close();
	});

	it('it should save a new session record', function(done) {
		this.store.set('1111222233334444', {cookie: {maxAge: 20000}, name: 'sample name'}, function(err, rows) {
			should.not.exist(err, 'set() returned an error');
			rows.should.eql([1]);
			done();
		});
	});


	it('it should retrieve an active session', function(done) {
		this.store.get('1111222233334444', function(err, session) {
			should.not.exist(err, 'get() returned an error');
			should.exist(session);
			(session).should.eql({cookie: {maxAge: 20000 }, name: 'sample name'});
			done();
		});
	});

	it('it should gracefully handle retrieving an unkonwn session', function(done) {
		this.store.get('hope-and-change', function(err, rows) {
			should.not.exist(err, 'get() unknown session returned an error');
			should.equal(undefined, rows, 'unknown session is not undefined');
			done();
		});
	});

	it('it should only contain one session', function(done) {
		this.store.length(function(err, len) {
			should.not.exist(err, 'session count returned an error');
			should.exist(len);
			len.should.equal(1);
			done();
		});
	});

	it('it should clear all session records', function(done) {
		var that = this;
		this.store.clear(function(err, success) {
			should.not.exist(err, 'clear returned an error');
			success.should.be.true;

			that.store.length(function(err, len) {
				should.not.exist(err, 'session count after clear returned an error');
				should.exist(len);
				len.should.equal(0);
				done();
			});
		});
	});

	it('it should destroy a session', function(done) {
		var that = this;
		this.store.set('555666777', {cookie: {maxAge: 1000}, name: 'Rob Dobilina'}, function(err, rows) {
			should.not.exist(err, 'set() returned an error');
			rows.should.eql([1]);

			that.store.destroy('555666777', function(err) {
				should.not.exist(err, 'destroy returned an error');

				that.store.length(function(err, len) {
					should.not.exist(err, 'session count after destroy returned an error');
					should.exist(len);
					len.should.equal(0);
					done();
				});
			});
		});
	});
});



describe('connect-session-knex postgreSQL test suite', function() {
	before(function() {
		this.store = postgresStore;
	});

	after(function() {
		// this.store.close();
	});

	it('it should save a new session record', function(done) {
		this.store.set('1111222233334444', {cookie: {maxAge: 20000}, name: 'sample name'}, function(err, rows) {
			should.not.exist(err, 'set() returned an error');
			rows.rowCount.should.eql(1);
			done();
		});
	});


	it('it should retrieve an active session', function(done) {
		this.store.get('1111222233334444', function(err, session) {
			should.not.exist(err, 'get() returned an error');
			should.exist(session);
			(session).should.eql({cookie: {maxAge: 20000 }, name: 'sample name'});
			done();
		});
	});

	it('it should gracefully handle retrieving an unkonwn session', function(done) {
		this.store.get('hope-and-change', function(err, rows) {
			should.not.exist(err, 'get() unknown session returned an error');
			should.equal(undefined, rows, 'unknown session is not undefined');
			done();
		});
	});

	it('it should only contain one session', function(done) {
		this.store.length(function(err, len) {
			should.not.exist(err, 'session count returned an error');
			should.exist(len);
			len.should.equal(1);
			done();
		});
	});

	it('it should clear all session records', function(done) {
		var that = this;
		this.store.clear(function(err, success) {
			should.not.exist(err, 'clear returned an error');
			success.should.be.true;

			that.store.length(function(err, len) {
				should.not.exist(err, 'session count after clear returned an error');
				should.exist(len);
				len.should.equal(0);
				done();
			});
		});
	});

	it('it should destroy a session', function(done) {
		var that = this;
		this.store.set('555666777', {cookie: {maxAge: 1000}, name: 'Rob Dobilina'}, function(err, rows) {
			should.not.exist(err, 'set() returned an error');
			rows.rowCount.should.eql(1);

			that.store.destroy('555666777', function(err) {
				should.not.exist(err, 'destroy returned an error');

				that.store.length(function(err, len) {
					should.not.exist(err, 'session count after destroy returned an error');
					should.exist(len);
					len.should.equal(0);
					done();
				});
			});
		});
	});
});
