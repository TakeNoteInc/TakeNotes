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
const response = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
});

//valid request check
function isValidRequest(context, event) {
  return (
    event !== null &&
    event.pathParameters !== null &&
    event.pathParameters.id !== null
  );
}

//get item for db and return only entries for given week property
function getRecordById(recordId, weekIdx) {
  console.log("setting up params...");
  let params = {
    TableName: TABLE_NAME,
    Key: {
      id: recordId,
    },
    ProjectionExpression: `docBody.journal.weeks[${weekIdx}]`,
  };
  console.log("params: " + params);
  return docClient.get(params);
}

// Lambda Handler
exports.getEntries = async (event, context, callback) => {
  if (!isValidRequest(context, event)) {
    return response(400, { message: "Error: Invalid request" });
  }

  try {
    console.log("id: " + event.pathParameters.id);
    let data = await getRecordById(
      event.pathParameters.id,
      event.pathParameters.weekIdx
    ).promise();
    if (data === null || data === undefined) {
      return response(404, { message: "Record not found" });
    }
    return response(200, data);
  } catch (err) {
    return response(400, { message: err.message });
  }
};
