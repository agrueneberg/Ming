(function () {
    "use strict";

    var mongo;

    mongo = require("mongodb");

    exports.getCollections = function (req, res, next) {
        req.db.collectionNames({
            namesOnly: true
        }, function (err, collections) {
            var names;
            if (err !== null) {
                next(err);
            } else {
                names = collections.map(function (collection) {
                 // Strip database name.
                    return collection.substring(collection.indexOf(".") + 1);
                });
                res.send({
                    collections: names
                });
                req.db.close();
            }
        });
    };

    exports.getCollection = function (req, res, next) {
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
    };

    exports.getFile = function (req, res, next) {
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
    };

    exports.getDocument = function (req, res, next) {
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
    };

    exports.getField = function (req, res, next) {
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
    };

    exports.query = function (req, res, next) {
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
    };

    exports.insertFile = function (req, res, next) {
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
    };

    exports.insertDocument = function (req, res, next) {
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
    };

    exports.updateDocument = function (req, res, next) {
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
    };

    exports.deleteFile = function (req, res, next) {
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
    };

    exports.deleteDocument = function (req, res, next) {
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
    };

}());
