(function () {
    "use strict";

    var argv, express, corser, mongo, url, app;

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
    corser = require("corser");
    mongo = require("mongodb");
    url = require("url");

    app = express();

 // Handle CORS.
    app.use(corser.create({
        methods: corser.simpleMethods.concat(["DELETE"]),
        requestHeaders: corser.simpleRequestHeaders.concat(["Authorization", "X-Connection-String"]),
        responseHeaders: corser.simpleResponseHeaders.concat(["Location"])
    }));

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

    app.get("/:prefix.files/:file", function (req, res, next) {
        var prefixParam, fileParam;
        prefixParam = req.params.prefix;
        fileParam = req.params.file;
        req.db.collection(prefixParam + ".files", function (err, collection) {
            var id;
            try {
                id = new mongo.ObjectID(fileParam);
             // Get metadata first.
                collection.findOne({
                    _id: id
                }, function (err, document) {
                    var grid;
                    if (document === null) {
                     // Route to catch-all.
                        next();
                    } else {
                        if (req.query.hasOwnProperty("binary") === true && req.query.binary === "true") {
                            grid = new mongo.Grid(req.db, prefixParam);
                            grid.get(id, function (err, file) {
                                var fileType;
                             // Guess file type from file extension.
                                fileType = document.filename.match(/(\.\w+)$/)[1];
                                res.type(fileType);
                                res.send(file);
                                req.db.close();
                            });
                        } else {
                            res.send(document);
                            req.db.close();
                        }
                    }
                });
            } catch (e) {
             // Route to catch-all.
                next();
            }
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

    app.get("/:collection/:document/:field", function (req, res, next) {
        var collectionParam, documentParam, fieldParam;
        collectionParam = req.params.collection;
        documentParam = req.params.document;
        fieldParam = req.params.field;
        req.db.collection(collectionParam, function (err, collection) {
            var id, fields;
            try {
                id = new mongo.ObjectID(documentParam);
                fields = {};
                fields[fieldParam] = 1;
                collection.findOne({
                    _id: id
                }, {
                    fields: fields
                }, function (err, document) {
                    if (document === null || document.hasOwnProperty(fieldParam) === false) {
                     // Route to catch-all.
                        next();
                    } else {
                        res.send(document[fieldParam]);
                    }
                    req.db.close();
                });
            } catch (e) {
             // Route to catch-all.
                next();
            }
        });
    });

    app.post("/:collection/query", express.json(), function (req, res) {
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

    app.post("/:collection", express.json(), function (req, res) {
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
                    _id: id
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

 // Terminate CORS preflights.
    app.options("*", function (req, res, next) {
        res.writeHead(204);
        res.end();
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
