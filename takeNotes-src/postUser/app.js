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
    if (event.body === null) {
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
let getWeeks = (start, end) => Math.round((getDateFromISO(end)-getDateFromISO(start))/WEEK_MILLISECONDS);

/**
 * This function takes the POST input and intializes a document matching our schema.
 * @param {object} body The POST input body, a parsed JSON object.
 * @return {object} 
 */
let generateDoc = (body) => {
    let numWeeks = getWeeks(body.start, body.end);
    if (numWeeks <= 0) {
        throw Error(`numWeeks is invalid: ${numWeeks}`);
    }
    return {
        email: body.email,
        journal: {
            weeks: Array(numWeeks).map(x => {
                let dateString = (new Date()).toISOString();
                return {
                    created: dateString,
                    updated: dateString,
                    entries: []
                }
            })
        },
        notes: []
    }
}

function addRecord(event) {
    // let usernameField = {
    //     "cognito-username": getCognitoUsername(event)
    // }
    let docBody = generateDoc(event.body);
    // auto generated date fields
    let d = (new Date()).toISOString();
    let autoFields = {
        "id": uuidv1(),
        "created": d,
        "updated": d
    };
    console.log(docBody.journal);

    //merge the json objects
    // let itemBody = { ...usernameField, ...autoFields, docBody }
    let itemBody = { ...autoFields, docBody };

    
    const params = {
        TableName: TABLE_NAME,
        Item: itemBody
    };
    console.log(params);
    
    return docClient.put(params);
}

// Lambda Handler
exports.postUser = async (event, context, callback) => {
    if (!isValidRequest(context, event)) {
        return response(400, { message: "Error: Invalid request" })
    }
    
    try {
        let data = await addRecord(event).promise()
        return response(200, data)
    } catch (err) {
        return response(400, { message: err.message })
    }
}
