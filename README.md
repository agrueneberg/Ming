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
- Run `node server.js` (see Usage)
- Put an SSL-enabled proxy in front of it

Usage
-----

- `port`: Server port
- `mongodb-host`: MongoDB host
- `mongodb-port`: MongoDB port
- `mongodb-database`: MongoDB database

Browser Client
--------------

### Embed Client

    <script src="myDeployment/client.js"></script>

### Connect to Ming

    db = ming({
        endpoint: "myDeployment",
        username: "myUsername",
        password: "myPassword"
    });

### Read

    db.collection("myCollection", function (err, collection) {
        collection.findOne("myId", function (err, item) {
            console.log(item);
        });
    });

### Query

    db.collection("myCollection", function (err, collection) {
        collection.find({
            name: "Ming"
        }, function (err, items) {
            console.log(items);
        });
    });

    db.collection("myCollection", function (err, collection) {
        collection.find({}, {
            sort: "name",
            limit: 2,
            skip: 2
        }, function (err, items) {
            console.log(items);
        });
    });

### Create

    item = {
        name: "Ming"
    };
    db.collection("myCollection", function (err, collection) {
        collection.insert(item, function (err, response) {
            console.log(response.id);
        });
    });

### Delete

    db.collection("myCollection", function (err, collection) {
        collection.remove("myId", function (err) {
            console.log("Deleted");
        });
    });
