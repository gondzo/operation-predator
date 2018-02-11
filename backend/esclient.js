// extend aws-es with index query and creation capabilities
require('./extend-es');

const Elasticsearch = require("aws-es"),
    moment = require("moment"),
    Promise = require('bluebird'),
    co = require('co');

Promise.promisifyAll(Elasticsearch.prototype);

class ElasticSearchClient {
    constructor(config) {
        this.config = config;
        this.client = new Elasticsearch(config.connectionConfig);
    }

    /**
     * Set's up the client to ensure the client and
     * indexes were setup
     */
    setup() {
        return co.wrap(function* () {
            let exists = yield this.client.indicesExistAsync(this.config.index);
            if ( !exists ) { // create index if it doesn't exist
                console.log(`The index ${this.config.index} did not exist, will create!`);
                yield this.client.indicesCreateAsync(this.config.index, {
                    mappings: {
                        scores: {
                            properties: {
                                date: {
                                    type: "date",
                                    format: "MM-DD-YYYY"
                                }
                            }
                        }
                    }
                });
                return yield Promise.resolve(true);
            } else {
                console.log(`The index ${this.config.index} already exists, will not create`);
                return yield Promise.resolve(true);
            }
        }.bind(this))();
    }

    index(value) {
        // add a date to the field
        value['date'] = moment().format("MM-DD-YYYY");
        return this.client.indexAsync({
            index: this.config.index,
            type: "scores",
            id: value.date,
            body: value
        });
    }

    /**
     * Search for documents greater than the
     * search date.
     * @param {*} searchDate Epoch ms date to start search from
     */
    search(searchDate) {
        let queryBody;
        if ( !!searchDate ) {
            queryBody = {
                size: 1,
                sort: {
                    date: 'asc'
                },
                query: {
                    range: {
                        date: {
                            gte: searchDate,
                            format: "MM-DD-YYYY"
                        }
                    }
                }
            };
        } else {
            // we need to figure out the latest indexed date, bring the last document
            queryBody = {
                size: 1,
                sort: {
                    date: 'desc'
                }
            }
        }

        return co.wrap(function*() {
            const fetch = function*() {
                let { hits } = yield this.client.searchAsync({
                    index: this.config.index,
                    type: "scores",
                    body: queryBody
                });
                return hits;
            }.bind(this);

            if ( !searchDate ) {
                let { hits } = yield fetch();
                // extract the date of the single result and try again
                if ( hits.length === 0 ) {
                    // return empty object for no results
                    return {}
                }

                let result = hits[0]._source;
                let date = result['date'];

                console.log(`found latest indexed date ${date}, searching again...`);

                return this.search(date);
            }

            let hits = yield fetch();
            return this.mapToResults(hits);
        }.bind(this))();
    }

    mapToResults(hits) {
        if ( hits.hits.length === 0 ) {
            // return empty object for no results
            return {}
        }

        let results = {};
        const hit = hits.hits[0]._source;
        const date = hit.date;
        results[date] = [];
        for ( let i = 0 ; i < hit.data.length ; i++ ) {
            let result = hits.hits[0]._source.data[i];
            
            // add result to collection of results
            results[date].push({
                name: result.techName,
                communityReady: result.tcCommunityReady,
                widelyUsed: result.widelyUsedonTc,
                crowdReady: result.tcCommunityReady<=3 ? "Y":"N",
                shouldSell: "N/A",
                type: "N/A"
            })
        }

        return results;
    }

}

/**
 * Creates and set's up an Elastic Search client
 * @param {*} config
 */
function createClient(config) {
    let client = new ElasticSearchClient(JSON.parse(JSON.stringify(config)));
    return co.wrap(function* () {
        yield client.setup();
        return Promise.resolve(client);
    })();
}

module.exports = {
    createClient
}
