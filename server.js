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
                 demand: true,
                 describe: "MongoDB Database"
              })
             .argv;
    express = require("express");
    corser = require("corser");
    mongo = require("mongodb");

    app = express();

 // Handle CORS
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

 // Basic auth.
    app.use(function (req, res, next) {
        (express.basicAuth(function (username, password, callback) {
            var client;
            client = new mongo.Db(argv["mongodb-database"], new mongo.Server(argv["mongodb-host"], argv["mongodb-port"]), {w: "majority"});
            client.open(function (err, db) {
                db.authenticate(username, password, function (err) {
                    if (err !== null) {
                     // Close database if authentication fails
                        db.close();
                        callback(err, null);
                    } else {
                     // Store reference to database in req.db
                        req.db = db;
                        callback(null, username);
                    }
                });
            });
        }, "MongoDB"))(req, res, next);
    });

 // Parse JSON.
    app.use(express.json());

    app.get("/:collection/:item", function (req, res, next) {
        var collectionParam, itemParam;
        collectionParam = req.params.collection;
        itemParam = req.params.item;
        req.db.collection(collectionParam, function (err, collection) {
            var id;
            try {
                id = new mongo.ObjectID(itemParam);
                collection.findOne({
                    _id: id
                }, function (err, item) {
                    res.send(item);
                    req.db.close();
                });
            } catch (e) {
                next(e);
            }
        });
    });

    app.post("/:collection", function (req, res) {
        var collectionParam, payload;
        collectionParam = req.params.collection;
        payload = req.body;
        req.db.collection(collectionParam, function (err, collection) {
            collection.insert(payload, {safe: true}, function (err, item) {
                res.location(collectionParam + "/" + item[0]._id.toHexString());
                res.send(201, "Created");
                req.db.close();
            });
        });
    });

    app.delete("/:collection/:item", function (req, res, next) {
        var collectionParam, itemParam;
        collectionParam = req.params.collection;
        itemParam = req.params.item;
        req.db.collection(collectionParam, function (err, collection) {
            var id;
            try {
                id = new mongo.ObjectID(itemParam);
                collection.remove({
                    _id: new mongo.ObjectID(itemParam)
                }, function () {
                    res.send(200, "Deleted");
                    req.db.close();
                });
            } catch (e) {
                next(e);
            }
        });
    });

    app.use(function(err, req, res, next){
        req.db.close();
        res.send(500, "Something broke!");
    });

    app.listen(argv.port);

}());
