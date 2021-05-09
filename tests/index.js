/* eslint-disable no-shadow */

const Promise = require('bluebird');

Promise.longStackTraces();

const test = require('tape');
const session = require('express-session');
const knexPg = require('knex')({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    user: 'postgres',
    password: process.env.IN_TRAVIS === 'yes' ? '' : 'postgres',
    database: 'travis_ci_test',
  },
});
const knexMysql = require('knex')({
  client: 'mysql',
  connection: {
    host: '127.0.0.1',
    user: 'travis',
    password: process.env.IN_TRAVIS === 'yes' ? '' : 'travis',
    database: 'travis_ci_test',
  },
});
const KnexStore = require('../lib')(session);


const stores = [];
stores.push(
  new KnexStore({
    db: ':memory:',
    dir: 'dbs',
  }),
);
stores.push(
  new KnexStore({
    knex: knexPg,
  }),
);
stores.push(
  new KnexStore({
    knex: knexMysql,
  }),
);

stores.forEach((store) => {
  test('initial clear', (t) => {
    t.plan(3);
    store.clear((err) => {
      t.error(err);

      store.length((err, len) => {
        t.error(err, 'no error after clear');
        t.equal(len, 0, 'empty after clear');
      });
    });
  });

  test('set then clear', (t) => {
    t.plan(4);

    store
      .set('1092348234', {
        cookie: {
          maxAge: 1000,
        },
        name: 'InsertThenClear',
      })
      .then(() => {
        store.clear((err, cleared) => {
          t.error(err);
          t.equal(1, cleared, 'cleared 1');

          store.length((err, len) => {
            t.error(err, 'no error after clear');
            t.equal(len, 0, 'empty after clear');
          });
        });
      });
  });

  test('double clear', (t) => {
    t.plan(4);

    store
      .clear()
      .then(() => store.clear())
      .then(() => {
        store.clear((err, cleared) => {
          t.error(err);
          t.equal(0, cleared, 'cleared 0');

          store.length((err, len) => {
            t.notOk(err, 'no error after clear');
            t.equal(len, 0, 'length');
          });
        });
      });
  });

  test('destroy', (t) => {
    t.plan(4);

    store.set(
      '555666777',
      {
        cookie: {
          maxAge: 1000,
        },
        name: 'Rob Dobilina',
      },
      (err, rows) => {
        t.error(err);
        if (rows.rowCount && rows.rowCount > 1) {
          t.fail('Row count too large');
        }

        store.destroy('555666777', (err) => {
          t.error(err);

          store.length((err, len) => {
            t.error(err, 'error');
            t.equal(len, 0);
          });
        });
      },
    );
  });

  test('set', (t) => {
    store.set(
      '1111222233334444',
      {
        cookie: {
          maxAge: 20000,
        },
        name: 'sample name',
      },
      (err, rows) => {
        t.error(err);
        if (rows.rowCount) {
          t.equal(rows.rowCount, 1, 'row count');
        }
        t.end();
      },
    );
  });

  test('retrieve', (t) => {
    t.plan(3);

    store.get('1111222233334444', (err, session) => {
      t.error(err);
      t.ok(session, 'session');
      t.deepEqual(session, {
        cookie: {
          maxAge: 20000,
        },
        name: 'sample name',
      });
    });
  });

  test('unknown session', (t) => {
    t.plan(2);

    store.get('hope-and-change', (err, rows) => {
      t.error(err);
      t.equal(rows, undefined, 'unknown session is not undefined');
    });
  });

  test('only one session should exist', (t) => {
    t.plan(2);

    store.length((err, len) => {
      t.error(err);
      t.equal(len, 1);
    });
  });

  test('touch', (t) => {
    t.plan(3);

    store
      .clear()
      .then(() => store.set('11112222333344445555', {
        cookie: {
          maxAge: 20000,
        },
        name: 'sample name',
      }))
      .then(() => {
        store.touch(
          '11112222333344445555',
          {
            cookie: {
              maxAge: 20000,
              expires: new Date(),
            },
            name: 'sample name',
          },
          (err) => {
            t.error(err);

            store.length((err, len) => {
              t.error(err, 'error');
              t.equal(len, 1);
            });
          },
        );
      });
  });

  test('retrieve all', (t) => {
    t.plan(6);
    t.timeoutAfter(2000);

    const session1 = {
      cookie: {
        maxAge: 20000,
        expires: new Date(),
      },
      name: 'retrieve-all session 1',
    };

    const session2 = {
      cookie: {
        maxAge: 20000,
        expires: new Date(),
      },
      name: 'retrieve-all session 2',
    };

    return store
      .clear()
      .then(() => store.set('123412341234', session1, (err) => t.error(err)))
      .then(() => store.set('432143214321', session2, (err) => t.error(err)))
      .then(() => store.all((err, sessions) => {
        t.error(err);
        t.equal(sessions.length, 2);
        sessions.forEach((session) => {
          // eslint-disable-next-line no-param-reassign
          session.cookie.expires = new Date(session.cookie.expires);
        });
        t.deepLooseEqual(sessions.find((s) => s.name === session1.name), session1);
        t.deepLooseEqual(sessions.find((s) => s.name === session2.name), session2);
      }));
  });

  test('cleanup', (t) => {
    store.knex.destroy().then(t.end);
  });
});
