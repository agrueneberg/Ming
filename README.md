Ming
====

A Quasi-RESTful Web Service for MongoDB.

Status
------

Just an experiment. It probably won't make you happy. Move along, there is nothing to see here.

Installation
------------

- Clone it
- Run `npm install`
- Run `node ming.js` (see Usage)
- Put an SSL-enabled proxy in front of it

Usage
-----

- `port`: Server port (default *1337*)
- `mongodb-host`: MongoDB host (default *127.0.0.1*)
- `mongodb-port`: MongoDB port (default *27017*)
- `mongodb-database`: MongoDB database (default *ming*)

### Example

    node ming.js --mongodb-database test

Clients
-------

- [Ming Fu](https://bitbucket.org/agrueneberg/ming-fu)
