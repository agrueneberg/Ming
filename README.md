Ming
====

Installation
------------

- Clone it
- Run `npm install`
- Run `node server.js` (see Usage)

Usage
-----

- `port`: Server port
- `mongodb-host`: MongoDB host
- `mongodb-port`: MongoDB port
- `mongodb-database`: MongoDB database

Examples
--------

### Read

xhr = new XMLHttpRequest();
xhr.open("GET", "http://localhost:1337/test/519a9b237f837c9ea78155de");
xhr.setRequestHeader("Authorization", "Basic " + btoa("username:password"));
xhr.send(null);

### Create

payload = {
    name: "Ming"
};
xhr = new XMLHttpRequest();
xhr.open("POST", "http://localhost:1337/test");
xhr.setRequestHeader("Authorization", "Basic " + btoa("username:password"));
xhr.setRequestHeader("Content-Type", "application/json");
xhr.send(JSON.stringify(payload));

### Delete

xhr = new XMLHttpRequest();
xhr.open("DELETE", "http://localhost:1337/test/519a9b237f837c9ea78155de");
xhr.setRequestHeader("Authorization", "Basic " + btoa("username:password"));
xhr.send(null);
