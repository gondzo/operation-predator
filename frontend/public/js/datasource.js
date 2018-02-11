(function (global, config) {
    "use strict";

    var inNodeJS = false;
    if (typeof module !== 'undefined' && module.exports) {
        inNodeJS = true;
        var request = require('request');
    }

    var supportsCORS = false;
    var inLegacyIE = false;
    try {
        var testXHR = new XMLHttpRequest();
        if (typeof testXHR.withCredentials !== 'undefined') {
            supportsCORS = true;
        } else {
            if ("XDomainRequest" in window) {
                supportsCORS = true;
                inLegacyIE = true;
            }
        }
    } catch (e) { }


    var Datasource = function (options) {
        // Make sure Datasource is being used as a constructor no matter what.
        if (!this || !(this instanceof Datasource)) {
            return new Datasource(options);
        }

        this.callback = options.callback;
        this.url = options.url;

        this.fetchData();
    };

    // Backwards compatibility.
    Datasource.init = function(options) {
        return new Datasource(options);
    };

    Datasource.prototype = {

        fetchData: function () {
            this.requestData(this.url, function (data, err) {
                if (err) { return this.callback(data, err); }
                // find the newest returned date, just in case the server sends more than one
                var newerKey = null;
                var newerDate = null;
                for (var key in data) {
                    if (data.hasOwnProperty && !data.hasOwnProperty(key)) { continue; }
                    var date = new Date(key);
                    if (!newerDate || newerDate < date) {
                        newerDate = date;
                        newerKey = key;
                    }
                }
                // filter out blank entries
                data[newerKey] = data[newerKey].filter(function (row) { return !!row[config.cellDisplayTitle]; });
                this.callback(data[newerKey]);
            }.bind(this));
        },

        /*
            This will call the environment appropriate request method.

            In browser it will use JSON-P, in node it will use request()
        */
        requestData: function (path, callback) {
            if (inNodeJS) {
                this.serverSideFetch(path, callback);
            } else {
                this.xhrFetch(path, callback);
            }
        },

        /*
            This will only run if datasource is being run in node.js
        */
        serverSideFetch: function(url, callback) {
            var self = this;
            request({url: url, json: true}, function(err, resp, body) {
                if (err) {
                    return console.error(err);
                }
                callback.call(self, body);
            });
        },

        /*
            Use Cross-Origin XMLHttpRequest to get the data in browsers that support it.
        */
        xhrFetch: function(url, callback) {
            //support IE8's separate cross-domain object
            var xhr = inLegacyIE ? new XDomainRequest() : new XMLHttpRequest();
            xhr.open("GET", url);
            var self = this;
            xhr.onload = function() {
                try {
                    var json = JSON.parse(xhr.responseText);
                    callback.call(self, json);
                } catch (e) {
                    callback.call(self, null, e);
                }
            };
            xhr.send();
        }
    };


    if (inNodeJS) {
        module.exports = Datasource;
    } else if (typeof define === 'function' && define.amd) {
        define(function () {
            return Datasource;
        });
    } else {
        global.Datasource = Datasource;
    }

})(this, this.TC_APP_CONFIG);
