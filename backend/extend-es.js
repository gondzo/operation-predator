const Elasticsearch = require("aws-es");

Elasticsearch.prototype.indicesExist = function (index, callback) {
    this._request(`/${index}`, null, { method: 'GET' }, function(err, data) {
        if(err) return callback(err);
        return callback(null, data.status !== 404);
    });
};

Elasticsearch.prototype.indicesCreate = function (index, body, callback) {
    this._request(`/${index}`, body, { method: 'PUT' }, function(err, data) {
        if(err) return callback(err);
        return callback(null, data);
    });
};
