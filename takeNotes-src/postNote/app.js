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

  let body = event.body;
  let isBodyValid = body !== null && body.notes !== null;

  return isIdValid && isBodyValid;
}

function updateRecord(recordId, eventBody, id) {
  let d = new Date();
  console.log("record id: " + recordId + " eventBody: " + eventBody.notes);
  let noteBody = eventBody.note;

  const metaFields = {
    id: id,
    created: d.toISOString(),
    updated: d.toISOString(),
  };

  const note = { ...metaFields, ...noteBody };
  const params = {
    TableName: TABLE_NAME,
    Key: {
      id: recordId,
    },
    UpdateExpression: `set updated = :u, docBody.notes.#noteId = :n`,
    ExpressionAttributeNames: { "#noteId": id },
    ExpressionAttributeValues: {
      ":u": d.toISOString(),
      ":n": note,
    },
    ConditionExpression: "attribute_not_exists(docBody.notes.#noteId)",
    ReturnValues: "ALL_NEW",
  };
  console.log("params: " + params);
  return docClient.update(params);
}

// Lambda Handler
exports.postNote = async (event, context, callback) => {
  console.log("event: " + event);
  console.log("body: " + event.body);
  if (!isValidRequest(context, event)) {
    return response(400, { message: "Error: Invalid request" });
  }

  try {
    const id = uuidv4();
    let data = await updateRecord(
      event.pathParameters.id,
      JSON.parse(event.body),
      id
    ).promise();
    return response(200, { data: data, id: id });
  } catch (err) {
    return response(500, { message: err.message });
  }
};
