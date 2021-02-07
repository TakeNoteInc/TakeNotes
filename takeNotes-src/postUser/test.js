const app = require("./app.js");

const inputObj = JSON.stringify({
  email: "johsn@smith.com",
  start: "2021-05-31",
  end: "2021-08-20",
});

app.postUser({ body: inputObj }, {}, null).then((x) => {
  console.log(x);
});
