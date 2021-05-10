Change Log

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

**2.1.0**
- [Add disableDbCleanup option](https://github.com/gx0r/connect-session-knex/pull/78)
- [Add Postgres support for case sensitive custom tablename](https://github.com/gx0r/connect-session-knex/pull/79)
- [Added 'lint' script to package.json](https://github.com/gx0r/connect-session-knex/pull/80)
- [Implemented store.all() method](https://github.com/gx0r/connect-session-knex/pull/81)

**2.0.0**
- [Fix typings for createtable option](https://github.com/llambda/connect-session-knex/pull/73) (As this fix is a typing change, a major version was incremented)

**1.7.3**
- [Fix handling datatype in older mysql versions(< 5.7.8)](https://github.com/gx0r/connect-session-knex/pull/68)

**1.7.2**

- Bug fix: fixed a typo. 'creatable' -> 'createtable'

**1.7.1**

- [Fix missing argument on next tick of dbCleanup](https://github.com/gx0r/connect-session-knex/pull/65)
- Split the lib into 1. lib 2. tests 3. examples 4. typings to make it more maintainable
- Added Changelog.md

**1.7.0**

- Added Typescript lib interface (index.d.ts)
- Added Airbnb Eslint configs and recommendations.
- Auto fixed many lint errors
- Removed NodeJS v8 testing from Travis
- Added instructions for testing
- Tests now require a password when running locally (While still the same when running on Travis) I did that because both dbs refused to connect locally without a password
- Auto lint both examples
- Moved many functions out of the lib's main closure, to make the code more clear and enforce the purity of these functions. Only the Store class is what remains in the closure (Because it requires the session object)
- Added knex to main dependencies instead of dev dependencies.
