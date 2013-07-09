(function () {
    "use strict";

    var argv, express, corser, mongo, app;

    argv = require("optimist")
             .options("port", {
                 default: 1337,
                 describe: "Port"
              })
             .options("mongodb-host", {
                 default: "127.0.0.1",
                 describe: "MongoDB Host"
              })
             .options("mongodb-port", {
                 default: "27017",
                 describe: "MongoDB Port"
              })
             .options("mongodb-database", {
                 default: "ming",
                 describe: "MongoDB Database"
              })
             .argv;
    express = require("express");
    corser = require("corser");
    mongo = require("mongodb");

    app = express();

 // Handle CORS.
    app.use(corser.create({
        methods: corser.simpleMethods.concat(["DELETE"]),
        requestHeaders: corser.simpleRequestHeaders.concat(["Authorization"]),
        responseHeaders: corser.simpleResponseHeaders.concat(["Location"])
    }));
    app.use(function (req, res, next) {
        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
        } else {
            next();
        }
    });

 // Prepare MongoDB client.
    app.use(function (req, res, next) {
        var client;
        client = new mongo.Db(argv["mongodb-database"], new mongo.Server(argv["mongodb-host"], argv["mongodb-port"]), {w: "majority"});
        client.open(function (err, db) {
            if (err !== null) {
                next(err);
            } else {
                req.db = db;
                next();
            }
        });
    });

 // Basic auth.
    app.use(function (req, res, next) {
        var basicAuth;
        basicAuth = express.basicAuth(function (username, password, callback) {
            req.db.authenticate(username, password, function (err) {
                if (err !== null) {
                 // Close database if authentication fails.
                    req.db.close();
                    callback(err, null);
                } else {
                    callback(null, username);
                }
            });
        }, "MongoDB");
        basicAuth(req, res, next);
    });

 // Parse JSON.
    app.use(express.json());

    app.get("/", function (req, res) {
        req.db.collectionNames({
            namesOnly: true
        }, function (err, collections) {
            var names;
            names = collections.map(function (collection) {
             // Strip database name.
                return collection.substring(argv["mongodb-database"].length + 1, collection.length);
            });
            res.send({
                collections: names
            });
            req.db.close();
        });
    });

    app.post("/:collection/query", function (req, res) {
        var collectionParam;
        collectionParam = req.params.collection;
        req.db.collection(collectionParam, function (err, collection) {
            var options;
            options = {};
            if (req.query.limit) {
                options.limit = req.query.limit;
            }
            if (req.query.skip) {
                options.skip = req.query.skip;
            }
            if (req.query.sort) {
                options.sort = req.query.sort;
            }
            collection.find(req.body, options).toArray(function (err, documents) {
                res.send(documents);
                req.db.close();
            });
        });
    });

    app.get("/:collection/:document", function (req, res, next) {
        var collectionParam, documentParam;
        collectionParam = req.params.collection;
        documentParam = req.params.document;
        req.db.collection(collectionParam, function (err, collection) {
            var id;
            try {
                id = new mongo.ObjectID(documentParam);
                collection.findOne({
                    _id: id
                }, function (err, document) {
                    if (document === null) {
                     // Route to catch-all.
                        next();
                    } else {
                        res.send(document);
                    }
                    req.db.close();
                });
            } catch (e) {
             // Route to catch-all.
                next();
            }
        });
    });

    app.get("/:collection", function (req, res) {
        var collectionParam;
        collectionParam = req.params.collection;
        req.db.collection(collectionParam, function (err, collection) {
            collection.find().count(function (err, count) {
                res.send({count: count});
                req.db.close();
            });
        });
    });

    app.post("/:collection", function (req, res) {
        var collectionParam, payload;
        collectionParam = req.params.collection;
        payload = req.body;
        req.db.collection(collectionParam, function (err, collection) {
            collection.insert(payload, {safe: true}, function (err, document) {
                res.location(collectionParam + "/" + document[0]._id.toHexString());
                res.send(201, "Created");
                req.db.close();
            });
        });
    });

    app.delete("/:collection/:document", function (req, res, next) {
        var collectionParam, documentParam;
        collectionParam = req.params.collection;
        documentParam = req.params.document;
        req.db.collection(collectionParam, function (err, collection) {
            var id;
            try {
                id = new mongo.ObjectID(documentParam);
                collection.remove({
                    _id: new mongo.ObjectID(documentParam)
                }, function (err, num) {
                    if (num === 0) {
                     // Route to catch-all.
                        next();
                    } else {
                        res.send(200, "Deleted");
                    }
                    req.db.close();
                });
            } catch (e) {
             // Route to catch-all.
                next();
            }
        });
    });

 // Catch-all.
    app.use(function (req, res) {
        req.db.close();
        res.send(404, "Not Found");
    });

 // Error handler.
    app.use(function (err, req, res, next) {
        if (req.hasOwnProperty("db") === true) {
            req.db.close();
        }
        res.send(500, "Internal Server Error");
    });

    app.listen(argv.port);

    console.log("Ming is running on port " + argv.port + ", connected to mongodb://" + argv["mongodb-host"] + ":" + argv["mongodb-port"] + "/" + argv["mongodb-database"]);

}());
