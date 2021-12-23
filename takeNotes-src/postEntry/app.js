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
    event.pathParameters.weekIdx !== null &&
    event.pathParameters.id !== null;

  let body = event.body;
  let isBodyValid = body !== null && body.entry !== null;

  return isIdValid && isBodyValid;
}

function updateRecord(recordId, weekIdx, eventBody, id) {
  let d = new Date();
  console.log("record id: " + recordId + " eventBody: " + eventBody.entry);
  let entryBody = eventBody.entry;

  const metaFields = {
    id: id,
    created: d.toISOString(),
    updated: d.toISOString(),
  };

  const entry = { ...metaFields, ...entryBody };

  const params = {
    TableName: TABLE_NAME,
    Key: {
      id: recordId,
    },
    UpdateExpression: `set updated = :u, docBody.journal.weeks[${weekIdx}].updated = :u, docBody.journal.weeks[${weekIdx}].entries.#entryId = :e`,
    ExpressionAttributeNames: { "#entryId": id },
    ExpressionAttributeValues: {
      ":u": d.toISOString(),
      ":e": entry,
    },
    ConditionExpression: `attribute_not_exists(docBody.journal.weeks[${weekIdx}].entries.#entryId)`,
    ReturnValues: "ALL_NEW",
  };
  console.log("params: " + params);
  return docClient.update(params);
}

// Lambda Handler
exports.postEntry = async (event, context, callback) => {
  console.log("event: " + event);
  console.log("body: " + event.body);
  if (!isValidRequest(context, event)) {
    return response(400, { message: "Error: Invalid request" });
  }

  try {
    const id = uuidv4();
    let data = await updateRecord(
      event.pathParameters.id,
      event.pathParameters.weekIdx,
      JSON.parse(event.body),
      id
    ).promise();
    return response(200, { data: data, id: id });
  } catch (err) {
    return response(500, { message: err.message });
  }
};
