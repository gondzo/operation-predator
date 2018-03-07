/**
 * This file represents index file of application.
 */
const express = require('express');
const _ = require('lodash');
const co = require('co');
const retry = require('co-retry');
const config = require('config');
const rp = require('request-promise');
const app = express();

const { createClient } = require("./esclient");


/**
 * Get data from looks api.
 * @returns the data from looks api
 */
function* getLooks() {
    console.log('get data from looks api');
    return yield rp(config.looksOptions);
}

/**
 * Get data from stackoverflows api.
 * @returns the data from stackoverflows api
 */
function* getStackoverflows() {
    console.log('get data from stackFlows api');
    return yield rp(config.stackFlowsOptions);
}

/**
 * Build match values with data from looks and stackoverflows api.
 * @param looks data from looks api
 * @param stackflows data from stackoverflows api
 * @param ready the ready value
 * @param looksIndex data index by name from looks api
 * @param stackflowsIndex data index by name from stackoverflows api
 * @returns {Array} the values with expected format.
 */
function buildArray(looks, stackflows, ready, looksIndex, stackflowsIndex) {
    const values = [];
    const names = _.uniq(_.concat(looks, stackflows));
    _.each(names, (name) => {
        const existLooks = _.includes(looks, name);
        values.push({
            techName: normalizeName(existLooks ? looksIndex[name].name : stackflowsIndex[name].name),
            tcCommunityReady: ready,
            count: existLooks ? Number(looksIndex[name]['challenge.count']) :
                Number(stackflowsIndex[name].count),
            widelyUsedonTc:  existLooks ? 'yes' : 'no',
            type: "N/A"
        });
    });
    return values;
}

function cleanName(name){

    name = name.replace(/-/g,' ');
    name = name.replace(/[\.\(\)]/g,'');
    name = name.toLowerCase();
    return name;
}

function normalizeName(name){
    name = name.replace(/-/g,' ');
    name = name.replace(/[\(\)]/g,'');
    if (name==name.toLowerCase()){
        name=toTitleCase(name);
    }
    return name;
}

function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function getData() {
    return co.wrap(function *() {
            let looks = String(config.mock) == 'true' ? require('./data/looker.json') : yield getLooks();
            let stackflows = String(config.mock) == 'true' ? require('./data/stackflows.json') : yield getStackoverflows();

            //filter out nulls
            looks = _.filter(looks, l => l['challenge_technology.name'] != null);
            stackflows = _.filter(stackflows.items, l => l['name'] != null);

            //normalize names for comparison
            looks = _.map(looks, l => {
                l.comparison_name=cleanName(l['challenge_technology.name']); 
                l.name = l['challenge_technology.name'];
                return l;
            });
            stackflows = _.map(stackflows, s => {
                s.comparison_name=cleanName(s['name']); 
                return s;
            });


            //const name = req.query.name;
            const orderedLooks = _.sortBy(
                looks,
                (l) => -Number(l['challenge.count']));
            const looksIndex = _.keyBy(orderedLooks, l => l.comparison_name);
            const orderedStackflows = _.sortBy(
                stackflows,
                (l) => -l.count);
            
            const stackflowsIndex = _.keyBy(orderedStackflows, s => s.comparison_name);
            const values = _.unionBy(
                buildArray(_(orderedLooks).filter(l => Number(l['challenge.count']) > 10)
                        .map(l => l.comparison_name).value(),
                    orderedStackflows.slice(0, 20).map(s => s.comparison_name), 1, looksIndex, stackflowsIndex),
                buildArray(_(orderedLooks).filter(l => Number(l['challenge.count']) < 10 && Number(l['challenge.count']) > 0)
                        .map(l => l.comparison_name).value(),
                    orderedStackflows.slice(20, 40).map(s => s.comparison_name), 2, looksIndex, stackflowsIndex),
                buildArray([], orderedStackflows.slice(40, 60).map(s => s.comparison_name), 3, looksIndex, stackflowsIndex),
                buildArray([], orderedStackflows.slice(60, 80).map(s => s.comparison_name), 4, looksIndex, stackflowsIndex),
                buildArray([], orderedStackflows.slice(80, 100).map(s => s.comparison_name), 5, looksIndex, stackflowsIndex),
                s=>s.techName
            );
            // produce json
            return values;
    })();
}

const createErrorResponse = (statusCode, message) => ({
    statusCode: statusCode || 501,
    headers: { 'Content-Type': 'text/plain' },
    body: message || 'Unknown server error occurred',
  });  

/**
 * Handler for fetching data to index into ElasticSearch
 */
module.exports.index = (event, context, callback) => {
    
    // create a wrapped promise job that can be retried
    let job = co.wrap(function* () {
        let client = yield createClient(config.elasticSearchConfig);
        let data = yield getData();
        yield client.index({data:data});

        if ( !!callback ) {
            callback(null, {
                statusCode: 200,
                body: `successfully indexed ${data.length} items`,
                headers: {
                    'Content-Type': 'text/plain'
                }
            })
        }
    });

    // generator that will attempt to retry the job up to three times...
    co(function* () {
        yield retry(job, {
            interval: 5000,
            retries: 2  // retry up to two times
        });
    }).catch((error) => {
        console.log(`Failed three times, will not retry. Error: ${JSON.stringify(error)}`)
    })
}

/**
 * Handler for serving results from ElasticSearch via
 * HTTP requests
 */
module.exports.api = (event, context, callback) => {
    co(function* () {
        let client = yield createClient(config.elasticSearchConfig);
        let searchDate = undefined;
        let qs = event.queryStringParameters;
        if ( !!qs && !!qs.date ) {
            searchDate = qs.date;
        }
        let results = yield client.search(searchDate);
        callback(null, {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin" : "*" // Required for CORS support to work
              },
            body: JSON.stringify(results)
        })
    }).catch((err) => {
        console.log(err);
        callback(null, createErrorResponse(501, err));
    });
}
