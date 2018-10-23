'use strict';

const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const { FakeDataStore } = require('./test/fake-db-model');
FakeDataStore.reset();

/**
 * Config
 */

function fakeApiMiddleWare (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  // intercepts OPTIONS method
  if (req.method === 'OPTIONS') {
    // respond with 200
    res.sendStatus(200).end();
    return;
  } else {
    const auth = req.header('Authorization');
    const re = /^\/token/;

    if (auth !== 'Bearer fake-token' && req.url.match(re) === null) {
      res.status(401);
      res.json({
        message: 'Invalid Authorization token'
      }).end();
      return;
    }
  }
  next();
}

app.use(bodyParser.json());
app.use('/', fakeApiMiddleWare);

app.get('/rules', (req, res) => {
  console.log(`from API: ${FakeDataStore.getTest()}`);
  res.send(FakeDataStore.getRules());
});

app.post('/rules', (req, res) => {
  FakeDataStore.addRule(req.body);
  res.sendStatus(200).end();
});

app.delete('/rules/:name', (req, res) => {
  FakeDataStore.deleteRule(req.params.name);
  res.sendStatus(200).end();
});

app.get('/token', (req, res) => {
  const url = req.query.state;
  if (url) {
    res.redirect(`${url}?token=fake-token`);
  } else {
    res.write('state parameter is missing');
    res.status(400).end();
  }
});

app.get('/auth', (req, res) => {
  res.status(200).end();
});

app.use('/', express.static('test/fake-api-fixtures', { index: 'index.json' }));

const port = process.env.PORT || 5001;

/**
 * Init
 */
app.listen(port, () => {
  console.log(`Starting server on port ${port}`);
});
