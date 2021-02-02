// response helper
const response = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});

// Lambda Handler
exports.testRequest = async (event, context, callback) => {
        try {
            let data = {
                event: event,
                context: context
            }
            // let data = await getRecordById(event.pathParameters.id).promise();
            return response(200, data);
        } catch (err) {
            return response(400, { message: err.message });
        }
    }

