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
    if (event.request === null) {
        return false;
    }

    // TODO: Validate/assert that the body matches our schema
    return true;
}

// function getCognitoUsername(event){
//     let authHeader = event.requestContext.authorizer;
//     if (authHeader !== null)
//     {
//         return authHeader.claims["cognito:username"];
//     }
//     return null;
// }

let getDateFromISO = (date) => (new Date(date));
let getNumWeeks = (start, end) => Math.round((getDateFromISO(end)-getDateFromISO(start))/WEEK_MILLISECONDS);

let getWeeks = (start, end) => {
    let numWeeks = getNumWeeks(start, end);
    if (numWeeks <= 0) {
        throw Error(`numWeeks is invalid: ${numWeeks}`);
    }
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
let generateDoc = (email) => {
    // TODO: Hardcoded, change asap
    let inputBody = {
        start: "2021-05-10",
        end: "2021-09-03"
    };
    let weeks = getWeeks(inputBody.start, inputBody.end);
    return {
        email: email,
        start: inputBody.start,
        end: inputBody.end,
        journal: {
            weeks: weeks
        },
        notes: []
    }
}

function addRecord(event) {
    // let usernameField = {
    //     "cognito-username": getCognitoUsername(event)
    // }
    let { email, sub } = event.request.userAttributes;
    let docBody = generateDoc(email);
    // auto generated date fields
    let d = (new Date()).toISOString();
    let autoFields = {
        "id": sub,
        "created": d,
        "updated": d
    };

    //merge the json objects
    // let itemBody = { ...usernameField, ...autoFields, docBody }
    let itemBody = { ...autoFields, docBody };

    
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
        // return response(400, {
        //     request: event.request,
        //     response: {
        //         message: "Error: Invalid request"
        //     }
        // })
        // return response(400, event);
        return callback(null, event);
    }
    
    try {
        let dbResp = addRecord(event);
        let [dbPromise, dbInput] = [await dbResp[0].promise(), dbResp[1]];
        
        let data = {
            request: event.request,
            response: {
                dbResp: dbPromise,
                input: dbInput 
            }
        };
        // return response(200, event);
        return callback(null, event);
    } catch (err) {
        // return response(400, { message: err.message })
        // return response(400, event);
        return callback(null, event);
    }
}
