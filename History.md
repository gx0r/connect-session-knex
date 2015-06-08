1.0.13 (2015-06-08)
==================
*  The dialect for MariaSQL is 'mariadb'. This was causing an error with the expired time. (Michael Pauley)

1.0.12 (2015-05-25)
==================
*  Don't use postgres fast query for version < 9.2 because the json type is not supported. (Matthew Gordon)

1.0.11 (2015-05-07)
==================
* Fix issue with SQLite. Many code cleanups. Tests refactored and ported to tape. Devdependencies removed. 

1.0.10 (2015-05-07)
==================
* Fix PostgreSQL not working (Daniel McKenzie)

1.0.9 (2015-04-04)
==================
* Fix issues where fixes issues where mariaDB queries weren't being handled the same as mysql (Dan Weber)

1.0.8 (2014-12-13)
==================

* PostgreSQL bugfixes. Now building on Travis CI.

1.0.6 (2014-12-13)
==================

* MySQL/Mariadb support

1.0.5 (2014-12-8)
==================

* Optimized SQLite3 query


1.0.4
==================
* Bugfixes


1.0.3
==================
* Bugfixes


1.0.2
==================
* Bugfixes


1.0.0
==================

* Updated Readme and benchmarks.


0.0.2
==================

* Optimized PostgreSQL query


0.0.1 (2014-07-09)
==================

  * Forked from connect-sqlite3
