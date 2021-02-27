// default imports
const AWS = require("aws-sdk");
const DDB = new AWS.DynamoDB({ apiVersion: "2012-10-08" });
const { v4: uuidv4 } = require("uuid");

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

  return isIdValid;
}

function updateRecord(recordId, noteIdx) {
  let d = new Date();
  console.log("record id: " + recordId + " noteIdx: " + noteIdx);
  const params = {
    TableName: TABLE_NAME,
    Key: {
      id: recordId,
    },
    UpdateExpression: `SET updated = :u REMOVE docBody.notes.#noteId`,
    ExpressionAttributeNames: { "#noteId": noteIdx },
    ExpressionAttributeValues: {
      ":u": d.toISOString(),
    },
    ConditionExpression: "attribute_exists(docBody.notes.#noteId)",
    ReturnValues: "ALL_NEW",
  };
  console.log("params: " + params);
  return docClient.update(params);
}

// Lambda Handler
exports.deleteNote = async (event, context, callback) => {
  console.log("event: " + event);
  console.log("body: " + event.body);
  if (!isValidRequest(context, event)) {
    return response(400, { message: "Error: Invalid request" });
  }

  try {
    let data = await updateRecord(
      event.pathParameters.id,
      event.pathParameters.noteIdx
    ).promise();
    return response(200, data);
  } catch (err) {
    return response(400, { message: err.message });
  }
};
