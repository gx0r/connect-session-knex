const test = require("node:test");
const assert = require("node:assert");

const session = require("express-session");
const knexPg = require("knex")({
  client: "pg",
  connection: {
    host: "127.0.0.1",
    user: "postgres",
    password: process.env.IN_TRAVIS === "yes" ? "" : "postgres",
    database: "travis_ci_test",
  },
});
const knexMysql = require("knex")({
  client: "mysql",
  connection: {
    host: "127.0.0.1",
    user: "travis",
    password: process.env.IN_TRAVIS === "yes" ? "" : "travis",
    database: "travis_ci_test",
  },
});
const KnexStore = require("../lib")(session);

const stores = [];
stores.push(
  new KnexStore({
    db: ":memory:",
    dir: "dbs",
    disableDbCleanup: true,
  }),
);

// Uncomment to test additional stores

// stores.push(
//   new KnexStore({
//     knex: knexPg,
//     disableDbCleanup: true,
//   }),
// );
// stores.push(
//   new KnexStore({
//     knex: knexMysql,
//     disableDbCleanup: true,
//   }),
// );

stores.forEach((store) => {
  test("initial clear", async () => {
    await store.clear();
    const len = await store.length();
    assert.strictEqual(len, 0);
  });

  test("set then clear", async () => {
    await store.set("1092348234", {
      cookie: {
        maxAge: 1000,
      },
      name: "InsertThenClear",
    });

    const cleared = await store.clear();

    assert.strictEqual(cleared, 1);

    const len = await store.length();
    assert.strictEqual(len, 0);
  });

  test("double clear", async () => {
    await store.clear();
    await store.clear();
    const cleared = await store.clear();
    assert.strictEqual(cleared, 0);

    const len = await store.length();
    assert.strictEqual(len, 0);
  });

  test("destroy", async () => {
    await store.set("555666777", {
      cookie: {
        maxAge: 1000,
      },
      name: "Rob Dobilina",
    });

    await store.destroy("555666777");

    const len = await store.length();
    assert.strictEqual(len, 0);
  });

  test("set", async () => {
    await store.set("1111222233334444", {
      cookie: {
        maxAge: 20000,
      },
      name: "sample name",
    });

    const len = await store.length();
    assert.strictEqual(len, 1);
  });

  test("retrieve", async () => {
    const session = await store.get("1111222233334444");

    assert.deepEqual(session, {
      cookie: {
        maxAge: 20000,
      },
      name: "sample name",
    });
  });

  test("unknown session", async () => {
    const item = await store.get("hope-and-change");
    assert.equal(item, undefined);
  });

  test("only one session should exist", async () => {
    const len = await store.length();
    assert.strictEqual(len, 1);
  });

  test("touch", async () => {
    await store.clear();

    await store.set("11112222333344445555", {
      cookie: {
        maxAge: 20000,
      },
      name: "sample name",
    });
    const item = await store.touch("11112222333344445555", {
      cookie: {
        maxAge: 20000,
        expires: new Date(),
      },
      name: "sample name",
    });
    const len = await store.length();
    assert.strictEqual(len, 1);
  });

  test("retrieve all", async () => {
    const session1 = {
      cookie: {
        maxAge: 20000,
        expires: new Date(),
      },
      name: "retrieve-all session 1",
    };

    const session2 = {
      cookie: {
        maxAge: 20000,
        expires: new Date(),
      },
      name: "retrieve-all session 2",
    };

    await store.clear();
    await store.set("123412341234", session1);
    await store.set("432143214321", session2);
    const sessions = await store.all();
    assert.equal(sessions.length, 2);

    sessions.forEach((session) => {
      session.cookie.expires = new Date(session.cookie.expires);
    });

    assert.deepEqual(
      sessions.find((s) => s.name === session1.name),
      session1,
    );

    assert.deepEqual(
      sessions.find((s) => s.name === session2.name),
      session2,
    );
  });

  test("no cleanup timeout when disableDbCleanup is true", () => {
    assert.equal(store.getNextDbCleanup(), null);
  });

  test("cleanup", async () => {
    await store.knex.destroy();
  });
});
