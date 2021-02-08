// default imports
const AWS = require("aws-sdk");
const DDB = new AWS.DynamoDB({ apiVersion: "2012-10-08" });
const {
  CognitoIdentityProviderClient,
  DeleteUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

// environment variables
const { TABLE_NAME, ENDPOINT_OVERRIDE, REGION } = process.env;
const options = { region: REGION };
AWS.config.update({ region: REGION });

if (ENDPOINT_OVERRIDE !== "") {
  options.endpoint = ENDPOINT_OVERRIDE;
}

const docClient = new AWS.DynamoDB.DocumentClient(options);
const cognitoClient = new CognitoIdentityProviderClient({
  region: "us-east-1",
});

// response helper
const response = (statusCode, body, additionalHeaders) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    ...additionalHeaders,
  },
});

function isValidRequest(context, event) {
  return (
    event !== null &&
    event.pathParameters !== null &&
    event.pathParameters.id !== null
  );
}

function deleteRecordById(recordId) {
  let params = {
    TableName: TABLE_NAME,
    Key: {
      id: recordId,
    },
  };
  return docClient.delete(params);
}

function setUpParams(body) {
  body = JSON.parse(body);
  let params = { AccessToken: body.token };
  console.log("body: " + body + " params: " + params);
  return params;
}

function deleteCognitoUser(body) {
  const command = new DeleteUserCommand(setUpParams(body));
  console.log(command);
  return cognitoClient.send(command);
}

// Lambda Handler
exports.deleteUser = async (event, context, callback) => {
  if (!isValidRequest(context, event)) {
    return response(400, { message: "Error: Invalid request" });
  }

  try {
    console.log(event);
    let data = await deleteCognitoUser(event.body);
    data = await deleteRecordById(event.pathParameters.id).promise();
    return response(200, data);
  } catch (err) {
    return response(400, { message: err.message });
  }
};
