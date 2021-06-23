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

app.post('/', requireBody({jobName:"xxxService", timeoutMinutes: 5, message: "service xxx is down"}), (req, res) => {
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
  jobTimeouts[jobId] = {timeout: t, meta};
  return res.status(200).send();
});


const initTemplate = Handlebars.compile(fs.readFileSync('./get.html', 'utf8'));
app.get('/', (req, res) => {
  const user = req.auth.user;
  var userJobs = Object.keys(jobTimeouts).filter(x => x.startsWith(user));
  var templateData = new Object();
  userJobs.forEach(x => templateData[x.slice(user.length)] = { timeout: getTimeLeft(jobTimeouts[x].timeout), meta: jobTimeouts[x].meta });

  const template = (process.env.NODE_ENV === 'production') ? initTemplate : Handlebars.compile(fs.readFileSync('./get.html', 'utf8'));

  const html = template(templateData);
  return res.send(html);
});

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
  

function getTimeLeft(timeout) {
  const milliseconds = timeout._idleStart + timeout._idleTimeout - (process.uptime() * 1000);
  const hhmmss = new Date(milliseconds).toISOString().substr(11, 8);
  const days = Math.floor(milliseconds / 86400000);
  return `${days}:${hhmmss}`;
}
