#!/usr/bin/env node

(function () {
    "use strict";

    var argv, express, corser, auth, rawBody, mongo, url, Q, connectionString, getDatabase, app;

    argv = require("optimist")
             .options("port", {
                 default: 1337,
                 describe: "Port"
             })
             .options("connection-string", {
                 default: "mongodb://localhost/ming",
                 describe: "MongoDB Connection String for the default deployment."
             })
             .argv;
    express = require("express");
    corser = require("corser");
    auth = require("basic-auth");
    mongo = require("mongodb");
    rawBody = require("raw-body");
    url = require("url");
    Q = require("q");

    connectionString = url.parse(argv["connection-string"], true);

    getDatabase = function () {
        var deferred = Q.defer();
        mongo.MongoClient.connect(url.format(connectionString), function (err, db) {
            if (err !== null) {
                deferred.reject(err);
            } else {
                deferred.resolve(db);
            }
        });
        return deferred.promise;
    };

    app = express();

    app.configure(function () {

     // Handle CORS.
        app.use(corser.create({
            methods: corser.simpleMethods.concat(["DELETE", "PATCH"]),
            requestHeaders: corser.simpleRequestHeaders.concat(["Authorization"]),
            responseHeaders: corser.simpleResponseHeaders.concat(["Location"])
        }));

     // Terminate CORS preflights.
        app.use(function (req, res, next) {
            if (req.method === "OPTIONS") {
                res.send(204);
            } else {
                next();
            }
        });

     // Prepare database for this request.
        app.use(function (req, res, next) {
            getDatabase().then(function (db) {
                req.db = db;
                next();
            }, function (err) {
                next(err);
            });
        });

     // Basic auth.
        app.use(function (req, res, next) {
            var unauthorized, user;
            unauthorized = function () {
                req.db.close();
                res.setHeader("WWW-Authenticate", "Basic realm=\"Ming\"");
                res.send(401, "Unauthorized");
            };
            user = auth(req);
            if (user === undefined) {
                unauthorized();
            } else {
                req.db.authenticate(user.name, user.pass, function (err, result) {
                    if (err !== null || result === false) {
                        unauthorized();
                    } else {
                        next();
                    }
                });
            }
        });

     // Deploy routes.
        app.use(app.router);

     // 404 handler.
        app.use(function (req, res) {
            req.db.close();
            res.send(404, "Not Found");
        });

     // 500 handler.
        app.use(function (err, req, res, next) {
            if (req.hasOwnProperty("db") === true) {
                req.db.close();
            }
            res.send(500, "Internal Server Error");
        });

    });

    app.get("/", function (req, res, next) {
        req.db.collectionNames({
            namesOnly: true
        }, function (err, collections) {
            var names;
            if (err !== null) {
                next(err);
            } else {
                names = collections.map(function (collection) {
                 // Strip database name.
                    return collection.substring(connectionString.pathname.length);
                });
                res.send({
                    collections: names
                });
                req.db.close();
            }
        });
    });

    app.get("/:collection", function (req, res, next) {
        var collectionParam;
        collectionParam = req.params.collection;
        req.db.collection(collectionParam, function (err, collection) {
            if (err !== null) {
                next(err);
            } else {
                collection.find().count(function (err, count) {
                    if (err !== null) {
                        next(err);
                    } else {
                        res.send({count: count});
                        req.db.close();
                    }
                });
            }
        });
    });

    app.get("/:prefix.files/:file", function (req, res, next) {
        var prefixParam, fileParam;
        prefixParam = req.params.prefix;
        fileParam = req.params.file;
        req.db.collection(prefixParam + ".files", function (err, collection) {
            var id;
            if (err !== null) {
                next(err);
            } else {
                try {
                    id = new mongo.ObjectID(fileParam);
                 // Get metadata first.
                    collection.findOne({
                        _id: id
                    }, function (err, document) {
                        var grid;
                        if (err !== null) {
                            next(err);
                        } else {
                            if (document === null) {
                             // Route to 404 handler.
                                next();
                            } else {
                                if (req.query.hasOwnProperty("binary") === true && req.query.binary === "true") {
                                    grid = new mongo.Grid(req.db, prefixParam);
                                    grid.get(id, function (err, file) {
                                        var contentType;
                                        if (err !== null) {
                                            next(err);
                                        } else {
                                            if (document.contentType) {
                                                contentType = document.contentType;
                                            } else if (document.filename) {
                                             // Guess file type from file extension.
                                                contentType = document.filename.match(/(\.\w+)$/)[1];
                                            } else {
                                                contentType = "application/octet-stream";
                                            }
                                            res.type(contentType);
                                            res.send(file);
                                            req.db.close();
                                        }
                                    });
                                } else {
                                    res.send(document);
                                    req.db.close();
                                }
                            }
                        }
                    });
                } catch (e) {
                 // Route to 404 handler.
                    next();
                }
            }
        });
    });

    app.get("/:collection/:document", function (req, res, next) {
        var collectionParam, documentParam;
        collectionParam = req.params.collection;
        documentParam = req.params.document;
        req.db.collection(collectionParam, function (err, collection) {
            var id;
            if (err !== null) {
                next(err);
            } else {
                try {
                    id = new mongo.ObjectID(documentParam);
                    collection.findOne({
                        _id: id
                    }, function (err, document) {
                        if (err !== null) {
                            next(err);
                        } else {
                            if (document === null) {
                             // Route to 404 handler.
                                next();
                            } else {
                                res.send(document);
                                req.db.close();
                            }
                        }
                    });
                } catch (e) {
                 // Route to 404 handler.
                    next();
                }
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
            if (err !== null) {
                next(err);
            } else {
                try {
                    id = new mongo.ObjectID(documentParam);
                    fields = {};
                    fields[fieldParam] = 1;
                    collection.findOne({
                        _id: id
                    }, {
                        fields: fields
                    }, function (err, document) {
                        if (err !== null) {
                            next(err);
                        } else {
                            if (document === null || document.hasOwnProperty(fieldParam) === false) {
                             // Route to 404 handler.
                                next();
                            } else {
                                res.send(document[fieldParam]);
                                req.db.close();
                            }
                        }
                    });
                } catch (e) {
                 // Route to 404 handler.
                    next();
                }
            }
        });
    });

    app.post("/:collection/query", express.json(), function (req, res) {
        var collectionParam;
        collectionParam = req.params.collection;
        req.db.collection(collectionParam, function (err, collection) {
            var options;
            if (err !== null) {
                next(err);
            } else {
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
                    if (err !== null) {
                        next(err);
                    } else {
                        res.send(documents);
                        req.db.close();
                    }
                });
            }
        });
    });

    app.post("/:prefix.files", function (req, res, next) {
        rawBody(req, function (err, buffer) {
            if (err !== null) {
                next(err);
            } else {
                req.body = buffer;
                next();
            }
        });
    }, function (req, res, next) {
        var prefixParam, contentType, grid;
        prefixParam = req.params.prefix;
        contentType = req.headers["content-type"];
        grid = new mongo.Grid(req.db, prefixParam);
        grid.put(req.body, {
            content_type: contentType
        }, function (err, document) {
            if (err !== null) {
                next(err);
            } else {
                res.location(prefixParam + ".files/" + document._id.toHexString());
                res.send(201, "Created");
                req.db.close();
            }
        });
    });

    app.post("/:collection", express.json(), function (req, res) {
        var collectionParam, payload;
        collectionParam = req.params.collection;
        payload = req.body;
        req.db.collection(collectionParam, function (err, collection) {
            if (err !== null) {
                next(err);
            } else {
                collection.insert(payload, function (err, document) {
                    if (err !== null) {
                        next(err);
                    } else {
                        res.location(collectionParam + "/" + document[0]._id.toHexString());
                        res.send(201, "Created");
                        req.db.close();
                    }
                });
            }
        });
    });

    app.patch("/:collection/:document", express.json(), function (req, res, next) {
        var collectionParam, documentParam;
        collectionParam = req.params.collection;
        documentParam = req.params.document;
        req.db.collection(collectionParam, function (err, collection) {
            var id;
            if (err !== null) {
                next(err);
            } else {
                try {
                    id = new mongo.ObjectID(documentParam);
                    collection.update({
                        _id: id
                    }, req.body, function (err) {
                        if (err !== null) {
                            next(err);
                        } else {
                            res.send(204, "No Content");
                            req.db.close();
                        }
                    });
                } catch (e) {
                 // Route to 404 handler.
                    next();
                }
            }
        });
    });

    app.delete("/:prefix.files/:file", function (req, res, next) {
        var prefixParam, fileParam, grid, id;
        prefixParam = req.params.prefix;
        fileParam = req.params.file;
        grid = new mongo.Grid(req.db, prefixParam);
        try {
            id = new mongo.ObjectID(fileParam);
            grid.delete(id, function (err, flag) {
                if (err !== null) {
                    next(err);
                } else {
                 // TODO: Detect if file was actually deleted.
                    res.send(200, "OK");
                    req.db.close();
                }
            });
        } catch (e) {
         // Route to 404 handler.
            next();
        }
    });

    app.delete("/:collection/:document", function (req, res, next) {
        var collectionParam, documentParam;
        collectionParam = req.params.collection;
        documentParam = req.params.document;
        req.db.collection(collectionParam, function (err, collection) {
            var id;
            if (err !== null) {
                next(err);
            } else {
                try {
                    id = new mongo.ObjectID(documentParam);
                    collection.remove({
                        _id: id
                    }, function (err, num) {
                        if (err !== null) {
                            next(err);
                        } else {
                            if (num === 0) {
                             // Route to 404 handler.
                                next();
                            } else {
                                res.send(200, "Deleted");
                                req.db.close();
                            }
                        }
                    });
                } catch (e) {
                 // Route to 404 handler.
                    next();
                }
            }
        });
    });

    app.listen(argv.port);

    console.log("Ming is running on port " + argv.port + ", connected to " + argv["connection-string"]);

}());
