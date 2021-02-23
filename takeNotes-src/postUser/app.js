// default imports
const { HttpResponse } = require("aws-sdk");
const AWS = require("aws-sdk");
const DDB = new AWS.DynamoDB({ apiVersion: "2012-10-08" });

// environment variables
const { TABLE_NAME, ENDPOINT_OVERRIDE, REGION } = process.env;
const options = { region: REGION };
AWS.config.update({ region: REGION });

// constants
const WEEK_MILLISECONDS = 604800000;

// globals
let invalidInputs = [];

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

//logger helper
const logger = (valueName, value) => console.log(`${valueName}: ${value}`);

function isValidEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

function isValidDate(date) {
  const re = /^\d{4}\-(0?[1-9]|1[012])\-(0?[1-9]|[12][0-9]|3[01])$/;
  return re.test(date);
}

function isValidRequest(context, event) {
  const body = JSON.parse(event.body);
  let isValid = true;
  if (event === null || body === null) return false;
  if (body.cognitoId === null) {
    invalidInputs.push("cognitoId");
    isValid = false;
  }
  if (body.email === null || !isValidEmail(body.email)) {
    invalidInputs.push("email");
    isValid = false;
  }
  if (body.startDate === null || !isValidDate(body.startDate)) {
    invalidInputs.push("startDate");
    isValid = false;
  }
  if (body.endDate === null || !isValidDate(body.endDate)) {
    invalidInputs.push("endDate");
    isValid = false;
  }
  return isValid 
}

let getDateFromISO = (date) => new Date(date);
let getNumWeeks = (start, end) => {
  let [startDateObj, endDateObj] = [getDateFromISO(start), getDateFromISO(end)];
  if (startDateObj.getTime() >= endDateObj.getTime())
    throw Error("End date is <= start date.");
  return Math.round((endDateObj - startDateObj) / WEEK_MILLISECONDS);
};

let getWeeks = (start, end) => {
  let numWeeks = getNumWeeks(start, end);
  logger("numweeks", numWeeks);
  let dateString = new Date().toISOString();
  let weeks = new Array(numWeeks);
  for (var i = 0; i < numWeeks; i++) {
    weeks[i] = {
      created: dateString,
      updated: dateString,
      entries: [],
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
  let [start, end] = [attributes.startDate, attributes.endDate];
  let weeks = getWeeks(start, end);
  return {
    email: attributes.email,
    start: start,
    end: end,
    journal: {
      weeks: weeks,
    },
    notes: {},
  };
};

function addRecord(event) {
  let attributes = JSON.parse(event.body);
  let docBody = generateDoc(attributes);

  let d = new Date().toISOString();
  let metaFields = {
    id: attributes.cognitoId,
    created: d,
    updated: d,
  };

  let itemBody = { ...metaFields, docBody };

  const params = {
    TableName: TABLE_NAME,
    Item: itemBody,
    ReturnValues: "ALL_OLD",
  };
  logger("params", params);

  // Return the new object
  return [docClient.put(params), params];
}

// Lambda Handler
exports.postUser = async (event, context, callback) => {
  logger("event", event);
  logger("event type", typeof event);
  logger("callback", callback);
  if (!isValidRequest(context, event)) {
    return response(400, { message: "Error: Invalid request", invalidInputs: invalidInputs });
  }

  try {
    let dbResp = addRecord(event);
    let [dbPromise, dbInput] = [await dbResp[0].promise(), dbResp[1]];

    return response(200, {
      promise: dbPromise,
      input: dbInput,
    });
  } catch (err) {
    logger("error", err.message);
    return response(500, { message: err.message });
  }
};
