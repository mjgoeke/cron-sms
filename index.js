const port = process.env.PORT || 3000;
const userDetails =  (process.env.NODE_ENV === 'production') ? JSON.parse(process.env.USER_DETAILS) : {user: {password: "pass", phoneNumber: "5555555555"}};
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const twilio = (process.env.NODE_ENV === 'production') ? require('twilio')(twilioAccountSid, twilioAuthToken) : undefined;

const express = require('express');
const basicAuth = require('express-basic-auth');

const fs = require('fs');
const Handlebars = require('handlebars');

const app = express();
app.use(express.json());

const basicAuthCredentials = {};
for (const u in userDetails) basicAuthCredentials[u] = userDetails[u].password;
app.use(basicAuth({ challenge: true, users: basicAuthCredentials }));

const jobTimeouts = {};

app.post('/api', requireBody({jobName:"xxxService", timeoutMinutes: 5, message: "service xxx is down"}), postJob);
app.post('/', requireBody({jobName:"xxxService", timeoutMinutes: 5, message: "service xxx is down"}), postJob); // maintain old address until clients have switched over

function postJob(req, res) {
  const { jobName, timeoutMinutes, message, initialMessage, meta } = req.body;
  const jobId = `${req.auth.user}${jobName}`;
  const phoneNumber = userDetails[req.auth.user].phoneNumber;
  
  if (initialMessage && !jobTimeouts[jobId]) {
    sendMessage(initialMessage, phoneNumber);
  }

  jobTimeouts[jobId] && clearTimeout(jobTimeouts[jobId].timeout);
  const t = setTimeout(() => {
    sendMessage(message, phoneNumber)
        .then(result => {
          delete jobTimeouts[jobId];
          if (result.status != 'accepted')
            console.log({result});
        });
    }, timeoutMinutes * 60 * 1000);
  jobTimeouts[jobId] = {timeout: t, timeoutMinutes, meta};
  return res.status(200).send();
}

app.get('/api', (req, res) => {
  const user = req.auth.user;
  res.send(getJobsDataFor(user));
})


var template = Handlebars.compile(fs.readFileSync('./index.handlebars', 'utf8'));
app.get('/', (req, res) => {
  const user = req.auth.user;
  var templateData = getJobsDataFor(user);
  
  if (process.env.NODE_ENV !== 'production') template = Handlebars.compile(fs.readFileSync('./index.handlebars', 'utf8'));

  const html = template(templateData);
  return res.send(html);
});

function getJobsDataFor(user) {
  var userJobs = user === 'admin' ? Object.keys(jobTimeouts) : Object.keys(jobTimeouts).filter(x => x.startsWith(user));
  if (user === 'admin') user = '00000000-0000-0000-0000-00000000'; //retain just the last 4 digits for uniqueness in troubleshooting
  var templateData = new Object();
  userJobs.forEach(x => templateData[x.slice(user.length)] = { timeout: getSecondsLeft(jobTimeouts[x].timeout), timeoutPercent: getSecondsLeft(jobTimeouts[x].timeout) / (jobTimeouts[x].timeoutMinutes * 60) * 100, meta: jobTimeouts[x].meta });
  return templateData;
}

app.listen(port);



//////////////////////////////////// utility functions //////////////////////////////////
function requireBody(expected) {
  return (req, res, next) => {
  for (const prop in expected) {
    if (!Object.prototype.hasOwnProperty.call(req.body, prop))
      return res.status(400).send("invalid request body, should be in the form of " + JSON.stringify(expected));
  }
  return next();
 }
}

const sendMessage = (process.env.NODE_ENV === 'production')
  ? (body, to) => twilio.messages.create({ messagingServiceSid, body, to })
  : (body, to) => new Promise(resolve => {
      console.log(`<sms> ${to} ${body}`);
      resolve({status: "accepted"});
  });
  

function getSecondsLeft(timeout) {
  const milliseconds = timeout._idleStart + timeout._idleTimeout - (process.uptime() * 1000);
  const seconds  =  milliseconds / 1000;
  return seconds;
}
