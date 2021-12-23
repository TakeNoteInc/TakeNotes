// default imports
const AWS = require("aws-sdk");
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
  let isIdValid =
    event !== null &&
    event.pathParameters !== null &&
    event.pathParameters.id !== null;

  let body = event.body;
  let isBodyValid = body !== null && body.journal !== null;

  return isIdValid && isBodyValid;
}

function updateRecord(recordId, eventBody) {
  let d = new Date();
  const params = {
    TableName: TABLE_NAME,
    Key: {
      id: recordId,
    },
    UpdateExpression: "set updated = :u, docBody.journal = :j",
    ExpressionAttributeValues: {
      ":u": d.toISOString(),
      ":j": eventBody.journal
    },
    ReturnValues: "ALL_NEW",
  };

  return docClient.update(params);
}

// Lambda Handler
exports.putJournal = async (event, context, callback) => {
  if (!isValidRequest(context, event)) {
    return response(400, { message: "Error: Invalid request" });
  }

  try {
    let data = await updateRecord(
      event.pathParameters.id,
      JSON.parse(event.body)
    ).promise();
    return response(200, data);
  } catch (err) {
    return response(400, { message: err.message });
  }
};
