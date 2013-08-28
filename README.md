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

- `port`: Ming Server port (default *1337*)
- `connection-string`: MongoDB [Connection String](http://docs.mongodb.org/manual/reference/connection-string/) for the default deployment (default *mongodb://localhost/ming*)
- `enable-proxying`: Allow connections to other MongoDB instances (see `X-Connection-String` header).

### Example

    node ming.js --connection-string mongodb://mymongoserver/mymongodb

Clients
-------

- [Ming Fu](https://bitbucket.org/agrueneberg/ming-fu)

API
---

### Routes

- `GET /` retrieve collection names
- `GET /:collection` retrieve collection statistics
- `GET /:collection/:document` retrieve document
- `GET /:collection/:document/:field` retrieve field of document
- `POST /:collection/query` query documents
- `POST /:collection` create document
- `DELETE /:collection/:document` delete document

### Headers

- `Authorization` basic HTTP authorization (e.g. in JavaScript `"Authorization : Basic " + btoa(username + ":" + password)`)
- `X-Connection-String` MongoDB [Connection String](http://docs.mongodb.org/manual/reference/connection-string/) for the current request
