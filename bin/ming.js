#!/usr/bin/env node

(function () {
    "use strict";

    var argv, express, corser, auth, rawBody, mongo, ming, Q, getDatabase, raw, app;

    argv = require("optimist")
             .options("port", {
                 default: 27080,
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
    rawBody = require("raw-body");
    mongo = require("mongodb");
    ming = require("../lib/ming");
    Q = require("q");

    getDatabase = function () {
        var deferred = Q.defer();
        mongo.MongoClient.connect(argv["connection-string"], function (err, db) {
            if (err !== null) {
                deferred.reject(err);
            } else {
                deferred.resolve(db);
            }
        });
        return deferred.promise;
    };

    raw = function () {
        return function (req, res, next) {
            rawBody(req, function (err, buffer) {
                if (err !== null) {
                    next(err);
                } else {
                    req.body = buffer;
                    next();
                }
            });
        };
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

     // 500 handler (signature must not be changed).
        app.use(function (err, req, res, next) {
            if (req.hasOwnProperty("db") === true) {
                req.db.close();
            }
            res.send(500, "Internal Server Error");
        });

    });

    app.get("/", ming.getCollections);
    app.get("/:collection", ming.getCollection);
    app.get("/:prefix.files/:file", ming.getFile);
    app.get("/:collection/:document", ming.getDocument);
    app.get("/:collection/:document/:field", ming.getField);
    app.post("/:collection/query", express.json(), ming.query);
    app.post("/:prefix.files", raw(), ming.insertFile);
    app.post("/:collection", express.json(), ming.insertDocument);
    app.patch("/:collection/:document", express.json(), ming.updateDocument);
    app.delete("/:prefix.files/:file", ming.deleteFile);
    app.delete("/:collection/:document", ming.deleteDocument);

    app.listen(argv.port);

    console.log("Ming is running on port " + argv.port + ", connected to " + argv["connection-string"]);

}());
