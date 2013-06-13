(function () {
    "use strict";

    var ajax, ming;

    ajax = function (options, callback) {
        var xhr, url;
        xhr = new XMLHttpRequest();
        url = options.url;
        Object.keys(options.params || {}).forEach(function (param, i) {
            if (i === 0) {
                url += "?";
            } else {
                url += "&";
            }
            url += param + "=" + encodeURIComponent(options.params[param]);
        });
        xhr.open(options.method, url);
        if (options.username && options.password) {
            xhr.setRequestHeader("Authorization", "Basic " + btoa(options.username + ":" + options.password));
        }
        Object.keys(options.headers || {}).forEach(function (name) {
            xhr.setRequestHeader(name, options.headers[name]);
        });
        xhr.onload = function () {
            var headers;
            if (xhr.status >= 200 && xhr.status < 300) {
                headers = {};
                xhr.getAllResponseHeaders().split("\n").filter(function (responseHeader) {
                    return responseHeader !== "";
                }).forEach(function (responseHeader) {
                    var pair, name;
                    pair = responseHeader.split(": ");
                    name = pair[0].toLowerCase();
                    if (headers.hasOwnProperty(name) === false) {
                        headers[name] = pair[1];
                    }
                });
                callback(null, {
                    status: xhr.status,
                    headers: headers,
                    body: xhr.responseText
                });
            } else {
                callback({
                    status: xhr.status,
                    message: xhr.statusText
                }, null);
            }
        };
        xhr.send(options.body || null);
    };

    ming = function (options) {
        options = options || {};
        if (options.hasOwnProperty("endpoint") === false) {
            throw new Error("Please provide an 'endpoint' parameter.");
        } else {
         // Trim trailing '/'.
            if (options.endpoint.charAt(options.endpoint.length - 1) === "/") {
                options.endpoint = options.endpoint.substring(0, options.endpoint.length);
            }
        }
        return {
            collection: function (collection, callback) {
                callback(null, {
                    find: function (query, opts, callback) {
                        if (typeof opts === "function") {
                            callback = opts;
                            opts = {};
                        }
                        ajax({
                            method: "POST",
                            url: options.endpoint + "/" + collection + "/query",
                            params: opts,
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(query),
                            username: options.username,
                            password: options.password
                        }, function (err, res) {
                            var items;
                            items = JSON.parse(res.body);
                            callback(err, items);
                        });
                    },
                    findOne: function (id, callback) {
                        ajax({
                            method: "GET",
                            url: options.endpoint + "/" + collection + "/" + id,
                            username: options.username,
                            password: options.password
                        }, function (err, res) {
                            var rep;
                            rep = JSON.parse(res.body);
                            callback(err, rep);
                        });
                    },
                    insert: function (item, callback) {
                        ajax({
                            method: "POST",
                            url: options.endpoint + "/" + collection,
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(item),
                            username: options.username,
                            password: options.password
                        }, function (err, res) {
                            callback(err, {
                                id: res.headers.location.substring(("/" + collection + "/").length, res.headers.location.length)
                            });
                        });
                    },
                    remove: function (id, callback) {
                        ajax({
                            method: "DELETE",
                            url: options.endpoint + "/" + collection + "/" + id,
                            username: options.username,
                            password: options.password
                        }, function (err, res) {
                            callback(err);
                        });
                    }
                });
            }
        };
    };

    window.ming = ming;

}());
