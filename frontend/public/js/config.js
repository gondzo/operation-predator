/**
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */
/**
 * configuration file
 * @version 1.0
 * @author lovefreya
 */

(function (global) {
    'use strict';

    global.TC_APP_CONFIG = {
        sortByColumns: {
            hotKey: 'communityReady',
            techNameKey: 'name'
        },

        //hot is defined by this column
        hotBy: 'communityReady',

        //key names in the spread sheet
        cellDisplayTitle: 'name',
        cellDisplayDesc: 'name',
        saleAbilityKeyName: 'shouldSell',
        communityReadinessKeyName: 'crowdReady',

        //event names to listen
        interactionEventNames: {
            RESET: 'reset',
            SALEABILITY: 'saleAbilityChanged',
            COMMUNITY_READY: 'communityReadiness',
            TECHNOLOGY_TYPE_SELECTED: 'technologyTypeSelected',
            EXPORT: 'export'
        },

        serverDataSource: 'https://1x64nyq0q0.execute-api.us-east-1.amazonaws.com/dev/search'
    };

})(this);
