const port = process.env.PORT || 3000;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const basicAuthCredentials = JSON.parse(process.env.BASIC_AUTH_CREDENTIALS);

const twilio = require('twilio')(twilioAccountSid, twilioAuthToken);
const express = require('express');
const basicAuth = require('express-basic-auth');

const app = express();
app.use(express.json());
app.use(basicAuth({ users: basicAuthCredentials }));

const jobTimeouts = {};

app.post('/', requireBody({jobName:"xxxService", phoneNumber:"555-123-4567", timeoutMinutes: 5, message: "service xxx is down"}), (req, res) => {
  const { jobName, phoneNumber, timeoutMinutes, message } = req.body;
  const jobId = `${req.auth.user}${jobName}`;
  jobTimeouts[jobId] && clearTimeout(jobTimeouts[jobId]);
  const tim = setTimeout(() => {
      sendMessage(message, phoneNumber)
        .then(result => {
          delete jobTimeouts[jobId];
          if (result.status != 'accepted')
            console.log({result});
        });
    }, timeoutMinutes * 60 * 1000);
    jobTimeouts[jobId] = tim;
  return res.status(200).send();
});

app.listen(port);

////////////////////////////////////
function requireBody(expected) {
  return (req, res, next) => {
  for (const prop in expected) {
    if (!Object.prototype.hasOwnProperty.call(req.body, prop))
      return res.status(400).send("invalid request body, should be in the form of " + JSON.stringify(expected));
  }
  return next();
 }
}

//function sendMessage(body, to) { return new Promise(() => console.log(`<sms> ${to} ${body}`)); }
function sendMessage(body, to) { return twilio.messages.create({ messagingServiceSid, body, to }); }