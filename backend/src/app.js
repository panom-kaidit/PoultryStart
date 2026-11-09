// Builds the Express application:
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/env');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet()); // sets safe HTTP headers
app.use(cors({ origin: config.corsOrigin })); // which frontend may call the API
app.use(express.json({ limit: '100kb' })); // parse JSON bodies

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
