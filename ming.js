(function () {
    "use strict";

    var argv, express, corser, mongo, app, url;

    argv = require("optimist")
             .options("port", {
                 default: 1337,
                 describe: "Port"
             })
             .options("connection-string", {
                 default: "mongodb://localhost/ming",
                 describe: "MongoDB Connection String for the default deployment."
             })
             .options("enable-proxying", {
                 default: false,
                 describe: "Allow connections to other MongoDB deployments."
             })
             .argv;
    express = require("express");
    url = require("url");
    corser = require("corser");
    mongo = require("mongodb");

    app = express();

 // Handle CORS.
    app.use(corser.create({
        methods: corser.simpleMethods.concat(["DELETE"]),
        requestHeaders: corser.simpleRequestHeaders.concat(["Authorization", "X-Connection-String"]),
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
        var connectionString;
        if (argv["enable-proxying"] === true && req.headers.hasOwnProperty("x-connection-string") === true) {
            connectionString = req.headers["x-connection-string"];
        } else {
            connectionString = argv["connection-string"];
        }
        req.connectionString = url.parse(connectionString);
        mongo.MongoClient.connect(connectionString, function (err, db) {
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
                return collection.substring(req.connectionString.path.length);
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
            collection.insert(payload, function (err, document) {
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

    console.log("Ming is running on port " + argv.port + ", connected to " + argv["connection-string"]);

}());
