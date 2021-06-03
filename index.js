const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

const setTimeoutPromise = require('./setTimeoutPromise').setTimeoutPromise;
const twilio = require('twilio')(twilioAccountSid, twilioAuthToken);
const express = require('express');


const jobs = {};
const app = express();
app.post('/:jobName/', (req, res) => {
  const jobName = req.params.jobName;
  const phoneNumber = req.query.phoneNumber;
  const timeoutMinutes = req.query.timeoutMinutes;
  const message = req.query.message;
  
  jobs[jobName]?.cancel();
  jobs[jobName] = setTimeoutPromise(timeoutMinutes * 60 * 1000)
    .promise.then(() => {
      sendMessage(message, phoneNumber);
      delete jobs[jobName];
    });
  res.status(200).send();
});

const sendMessage = (body, to) => 
  twilio.messages.create({
    messagingServiceSid,
    body,
    to
  });

//ideally we would verify the twilio credentials and log+die if invalid

app.listen(80);