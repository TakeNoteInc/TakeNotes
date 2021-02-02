// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// default imports
const AWS = require('aws-sdk');
const DDB = new AWS.DynamoDB({ apiVersion: "2012-10-08" });


// environment variables
const { TABLE_NAME, ENDPOINT_OVERRIDE, REGION } = process.env;
const options = { region: REGION };
AWS.config.update({ region: REGION });

if (ENDPOINT_OVERRIDE !== "") {
    options.endpoint = ENDPOINT_OVERRIDE;
}

const docClient = new AWS.DynamoDB.DocumentClient(options);
// response helper
const response = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});

function isValidRequest(context, event) {
    return (event !== null) &&
        (event.pathParameters !== null) &&
        (event.pathParameters.id !== null);
}

function getCognitoUsername(event){
    let authHeader = event.requestContext.authorizer;
    if (authHeader !== null)
    {
        return authHeader.claims["cognito:username"];
    }
    return null;

}

function getRecordById(username, recordId) {
    let params = {
        TableName: TABLE_NAME,
        Key: {
            "cognito-username": username,
            "id": recordId
        }
    };

    return docClient.get(params);
}

// Lambda Handler
exports.getUser = async (event, context, callback) => {
        if (!isValidRequest(context, event)) {
            return response(400, { message: "Error: Invalid request" });
        }

        try {
            let username = getCognitoUsername(event);
            let data = await getRecordById(username, event.pathParameters.id).promise()
            // let data = await getRecordById(event.pathParameters.id).promise();
            return response(200, data);
        } catch (err) {
            return response(400, { message: err.message });
        }
    }
