const port = process.env.PORT || 3000;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const basicAuthCredentials = JSON.parse(process.env.BASIC_AUTH_CREDENTIALS);

const twilio = require('twilio')(twilioAccountSid, twilioAuthToken);
const express = require('express');
const app = express();
const basicAuth = require('express-basic-auth');

app.use(basicAuth({ users: basicAuthCredentials }));

const jobs = {};

app.post('/', (req, res) => {
  const q = { jobName: req.query.jobName, phoneNumber: req.query.phoneNumber, timeoutMinutes: req.query.timeoutMinutes, message: req.query.message };
  if (!q.jobName || !q.phoneNumber || !q.timeoutMinutes || !q.message){
    res.status(400).send();
    return;
  }
  const userJobName = req.user + q.jobName;
  jobs[userJobName] && jobs[userJobName].cancel();
  jobs[userJobName] = setTimeoutPromise(q.timeoutMinutes * 60 * 1000);
  jobs[userJobName]
    .promise.then(() => {
      sendMessage(q.message, q.phoneNumber)
        .then(result => {
          delete jobs[userJobName];
          if (result.status != 'accepted')
            console.log({result});
        });
    })
    .catch(() => {});
  res.status(200).send();
});
app.listen(port);

const sendMessage = (body, to) => 
  twilio.messages.create({
    messagingServiceSid,
    body,
    to
  });

const setTimeoutPromise = (delay) => {
    let timer = 0;
    let reject = null;
    const promise = new Promise((resolve, _reject) => {
        reject = _reject;
        timer = setTimeout(resolve, delay);
    });
    return { 
      get promise() { return promise; },
      cancel() {
        if (timer) {
            clearTimeout(timer);
            timer = 0;
            reject();
            reject = null;
        }
      }
    };
}