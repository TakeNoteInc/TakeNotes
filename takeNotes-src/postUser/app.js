// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// default imports
const AWS = require('aws-sdk');
const DDB = new AWS.DynamoDB({ apiVersion: "2012-10-08" });
const { v1: uuidv1 } = require('uuid');

// environment variables
const { TABLE_NAME, ENDPOINT_OVERRIDE, REGION } = process.env;
const options = { region: REGION };
AWS.config.update({ region: REGION });

// constants
const WEEK_MILLISECONDS = 604800000;

if (ENDPOINT_OVERRIDE !== "") {
    options.endpoint = ENDPOINT_OVERRIDE;
}

const docClient = new AWS.DynamoDB.DocumentClient(options);

// response helper
const response = (statusCode, body, additionalHeaders) => ({
    statusCode,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...additionalHeaders },
});

function isValidRequest(context, event) {
    if (event.request !== null && 
        event.request.userAttributes !== null &&
        event.request.userAttributes['custom:startDate'] !== null &&
        event.request.userAttributes['custom:endDate'] !== null &&
        event.request.userAttributes.email !== null &&
        event.request.userAttributes.sub !== null) {
        return true;
    }

    return false;
}

let getDateFromISO = (date) => (new Date(date));
let getNumWeeks = (start, end) => {
    let [startDateObj, endDateObj] = [getDateFromISO(start), getDateFromISO(end)];
    if (startDateObj.getTime() >= endDateObj.getTime()) throw Error("End date is <= start date.");
    return Math.round((endDateObj-startDateObj)/WEEK_MILLISECONDS);
};

let getWeeks = (start, end) => {
    let numWeeks = getNumWeeks(start, end);
    let dateString = (new Date()).toISOString();
    let weeks = new Array(numWeeks);
    for (var i = 0; i < numWeeks; i++) {
        weeks[i] = {
            created: dateString,
            updated: dateString,
            entries: []
        };
    }
    return weeks;
};

/**
 * This function takes the POST input and intializes a document matching our schema.
 * @param {object} body The POST input body, a parsed JSON object.
 * @return {object} 
 */
let generateDoc = (attributes) => {
    let [start, end] = [attributes['custom:startDate'], attributes['custom:endDate']];
    let weeks = getWeeks(start, end);
    return {
        email: attributes.email,
        start: start,
        end: end,
        journal: {
            weeks: weeks
        },
        notes: []
    }
}

function addRecord(event) {
    let attributes = event.request.userAttributes;
    let docBody = generateDoc(attributes);
    
    let d = (new Date()).toISOString();
    let metaFields = {
        "id": attributes.sub,
        "created": d,
        "updated": d
    };

    let itemBody = { ...metaFields, docBody };

    const params = {
        TableName: TABLE_NAME,
        Item: itemBody,
        ReturnValues: 'ALL_OLD'
    };
    console.log("params");
    console.log(params);

    // Return the new object
    return [docClient.put(params), params];
}

// Lambda Handler
exports.postUser = async (event, context, callback) => {
    console.log("event");
    console.log(event);
    console.log("callback");
    console.log(callback);
    if (!isValidRequest(context, event)) {
        return callback(Error("Request is invalid!"), event);
    }
    
    try {
        let dbResp = addRecord(event);
        let [dbPromise, dbInput] = [await dbResp[0].promise(), dbResp[1]];
        
        return callback(null, event);
    } catch (err) {
        return callback(err, event);
    }
}
