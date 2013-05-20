(function () {
    "use strict";

    var express, corser, mongo, app;

    express = require("express");
    corser = require("corser");
    mongo = require("mongodb");

    app = express();

 // Handle CORS
    app.use(corser.create({
        methods: ["GET", "POST", "DELETE"]
    }));
    app.use(function (req, res, next) {
        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
        } else {
            next();
        }
    });

 // Parse JSON.
    app.use(express.json());

    app.get("/:collection/:item", function (req, res, next) {
        var collectionParam, itemParam, client;
        collectionParam = req.params.collection;
        itemParam = req.params.item;
        client = new mongo.Db("test", new mongo.Server("127.0.0.1", 27017), {w: "majority"});
        client.open(function (err, pDb) {
            pDb.collection(collectionParam, function (err, pCollection) {
                var id;
                try {
                    id = new mongo.ObjectID(itemParam);
                    pCollection.findOne({
                        _id: id
                    }, function (err, item) {
                        res.send(item);
                        pDb.close();
                    });
                } catch (e) {
                    next(e);
                }
            });
        });
    });

    app.post("/:collection", function (req, res) {
        var collectionParam, payload, client;
        collectionParam = req.params.collection;
        payload = req.body;
        client = new mongo.Db("test", new mongo.Server("127.0.0.1", 27017), {w: "majority"});
        client.open(function (err, pDb) {
            pDb.collection(collectionParam, function (err, pCollection) {
                pCollection.insert(payload, function () {
                    res.send(201, "Created");
                    pDb.close();
                });
            });
        });
    });

    app.delete("/:collection/:item", function (req, res, next) {
        var collectionParam, itemParam, client;
        collectionParam = req.params.collection;
        itemParam = req.params.item;
        client = new mongo.Db("test", new mongo.Server("127.0.0.1", 27017), {w: "majority"});
        client.open(function (err, pDb) {
            pDb.collection(collectionParam, function (err, pCollection) {
                var id;
                try {
                    id = new mongo.ObjectID(itemParam);
                    pCollection.remove({
                        _id: new mongo.ObjectID(itemParam)
                    }, function () {
                        res.send(200, "Deleted");
                        pDb.close();
                    });
                } catch (e) {
                    next(e);
                }
            });
        });
    });

    app.use(function(err, req, res, next){
        res.send(500, "Something broke!");
    });

    app.listen(1337);

}());
