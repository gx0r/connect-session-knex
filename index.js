'use strict';
var util = require('util');

var oneDay = 86400000;

module.exports = function(connect) {

/**
* Connect's Store.
*/
var Store = (connect.session) ? connect.session.Store : connect.Store;

/*
 * Return an ISO compliant string of the current time
 * @api private
 * @return {String} an ISO compliant string of the current time
 */
function nowAsISO() {
	return (new Date()).toISOString();
}

/*
 * Return dialect-aware type name for timestamp
 * @return {String} type name for timestamp
 * @api private
 */
function timestampTypeName(knex) {
	return (['mysql', 'mariasql', 'mariadb'].indexOf(knex.client.dialect) > -1) ? 'DATETIME' : 'timestamp';
}

/*
* Remove expired sessions from database.
* @param {Object} store
* @api private
*/
function dbCleanup(store) {
	return store.ready.then(function () {
		return store.knex(store.tablename).del()
		.whereRaw('expired < CAST(? as ' + timestampTypeName(store.knex) + ')', nowAsISO());
	});
}

/*
* Initialize KnexStore with the given options.
*
* @param {Object} options
* @api public
*/
function KnexStore(options) {
	var self = this;

	options = options || {};
	Store.call(self, options);

	self.tablename = options.tablename || 'sessions';
	self.knex = options.knex || require('knex')({
		client: 'sqlite3',
		// debug: true,
		connection: {
			filename: "connect-session-knex.sqlite"
		}
	});

	self.ready = self.knex.schema.hasTable(self.tablename)
	.then(function (exists) {
		if (!exists) {
			return self.knex.schema.createTable(self.tablename, function (table) {
				table.string('sid').primary();
				table.json('sess').notNullable();
				if (['mysql', 'mariasql'].indexOf(self.knex.client.dialect) > -1) {
					table.dateTime('expired').notNullable();
				} else {
					table.timestamp('expired', 'true').notNullable();
				}
			});
		}
	})
	.then(function () {
		dbCleanup(self);
		setInterval(dbCleanup, oneDay, self).unref();
	});
}

// KnexStore.prototype.__proto__ = Store.prototype;
util.inherits(KnexStore, Store);

/*
* Attempt to fetch session by the given sid.
*
* @param {String} sid
* @param {Function} fn
* @api public
*/
KnexStore.prototype.get = function(sid, fn) {
	var self = this;
	return self.ready.then(function () {
		return self.knex
			.select('sess')
			.from(self.tablename)
			.where('sid', '=', sid)
			.andWhereRaw('CAST(? as '+timestampTypeName(self.knex)+') <= expired', nowAsISO())
			.then(function (response) {
				var ret;
				if (response[0]) {
					ret = response[0].sess;
					if (typeof ret === "string") {
						ret = JSON.parse(ret);
					}
				}

				if (fn) fn(null, ret);
				return ret;
			}).catch(function(err) {
				if (fn) fn(err);
				throw err;
			});
	});
};


/*
* Commit the given `sess` object associated with the given `sid`.
*
* @param {String} sid
* @param {Session} sess
* @param {Function} fn
* @api public
*/
KnexStore.prototype.set = function(sid, sess, fn) {
	var self = this;
	var maxAge = sess.cookie.maxAge;
	var now = new Date().getTime();
	var expired = maxAge ? now + maxAge : now + oneDay;
	sess = JSON.stringify(sess);
	var postgresfastq = 'with new_values (sid, expired, sess) as (' +
					'  values (?, ?::timestamp without time zone, ?::json)' +
					'), ' +
					'upsert as ' +
					'( ' +
					'  update ' + self.tablename + ' cs set ' +
					'    sid = nv.sid, ' +
					'    expired = nv.expired, ' +
					'    sess = nv.sess ' +
					'  from new_values nv ' +
					'  where cs.sid = nv.sid ' +
					'  returning cs.* ' +
					')' +
					'insert into ' + self.tablename + ' (sid, expired, sess) ' +
					'select sid, expired, sess ' +
					'from new_values ' +
					'where not exists (select 1 from upsert up where up.sid = new_values.sid)';

	var sqlitefastq = 'insert or replace into ' + self.tablename + ' (sid, expired, sess) values (?, ?, ?);';

	var mysqlfastq = 'insert into ' + self.tablename + ' (sid, expired, sess) values (?, ?, ?) on duplicate key update expired=values(expired), sess=values(sess);';

	if (self.knex.client.dialect === 'sqlite3') {
		// sqlite optimized query
		return self.ready.then(function () {
			return self.knex.raw(sqlitefastq, [sid, new Date(expired).toISOString(), sess ])
			.then(function (result) {
				if (fn && result instanceof Array) {
					fn(null, [1]);
				}
				if (result instanceof Array) {
					return [1];
				}
			})
			.catch(function (err) {
				fn(err);
				throw err;
			});
		});
	} else if (self.knex.client.dialect === 'postgresql' && parseFloat(self.knex.client.version) >= 9.2) {
		// postgresql optimized query
		return self.ready.then(function () {
			return self.knex.raw(postgresfastq, [sid, new Date(expired).toISOString(), sess ])
			.then(function (result) {
				if (fn) fn(null, result);
				return result;
			})
			.catch(function (err) {
				fn(err);
				throw err;
			});
		});
	} else if (['mysql', 'mariasql'].indexOf(self.knex.client.dialect) > -1) {
		// mysql/mariaDB optimized query
		return self.ready.then(function () {
			return self.knex.raw(mysqlfastq, [sid, new Date(expired).toISOString(), sess ])
			.then(function (result) {
				if (fn) fn(null, result);
				return result;
			})
			.catch(function (err) {
				fn(err);
				throw err;
			});
		});
	} else {
		return self.ready.then(function () {
			return self.knex.transaction(function (trx) {
				return trx.select('*')
				.forUpdate()
				.from(self.tablename)
				.where('sid', '=', sid)
				.then(function (foundKeys) {
					if (foundKeys.length === 0) {
						return trx.from(self.tablename)
						.insert({
							sid: sid,
							expired: new Date(expired).toISOString(),
							sess: sess
						});
					} else {
						return trx(self.tablename)
						.where('sid', '=', sid)
						.update({
							expired: new Date(expired).toISOString(),
							sess: sess
						});
					}
				});
			})
			.then(function (res) {
				if (fn) fn(null, res);
				return res;
			})
			.catch(function(err) {
				if (fn) fn(err);
				throw err;
			});
		});
	}
};


/*
* Destroy the session associated with the given `sid`.
*
* @param {String} sid
* @api public
*/
KnexStore.prototype.destroy = function(sid, fn) {
	var self = this;
	return self.ready.then(function () {
		return self.knex.del()
		.from(self.tablename)
		.where('sid', '=', sid)
		.then(function (res) {
			if (fn) fn(null, res);
			return res;
		})
		.catch(function(err) {
			if (fn) fn(err);
			throw err;
		});
	});
};


/*
* Fetch number of sessions.
*
* @param {Function} fn
* @api public
*/
KnexStore.prototype.length = function(fn) {
	var self = this;
	return self.ready.then(function () {
		return self.knex.count('sid as count')
		.from(self.tablename)
		.then(function (response) {
			var ret = response[0].count | 0;
			if (fn) fn(null, ret);
			return ret;
		})
		.catch(function(err) {
			fn(err);
			throw err;
		});
	});
};


/*
* Clear all sessions.
*
* @param {Function} fn
* @api public
*/
KnexStore.prototype.clear = function(fn) {
	var self = this;
	return self.ready.then(function () {
		return self.knex.del()
		.from(self.tablename)
		.then(function (res) {
			if (fn) fn(null, res);
			return res;
		})
		.catch(function(err) {
			fn(err);
			throw err;
		});
	});
};

return KnexStore;

};
