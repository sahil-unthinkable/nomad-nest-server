const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const { sendErrorMail } = require('./utils/sendMail');

let server;
mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
  logger.info('Connected to MongoDB');
  server = app.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);
  });
});

const exitHandler = (error, errorType, req = {}) => {
  logger.error('uncaughtException or unhandledRejection>>>>>>>>>>>>>>>>');
  const mailParams = {
    subject: `${errorType} Dope Doctors`,
    text: `${error.message}params<---->${JSON.stringify(req.params)}query<---->${JSON.stringify(req.query)}body<---->${JSON.stringify(req.body)}path<---->${JSON.stringify(req.path)}`,
    to: config.email.applicationDeveloper,
  };
  sendErrorMail(mailParams);
  // if (server) {
  //   server.close(() => {
  //     // process.exit(1);
  //   });
  // } else {
  //   process.exit(1);
  // }
};

const unexpectedErrorHandler = (errorType) => {
  return (error) => {
    logger.error(error);
    exitHandler(error, errorType , process.currentReq);
  };
};

process.on('uncaughtException', unexpectedErrorHandler('UncaughtException'));
process.on('unhandledRejection', unexpectedErrorHandler('UnhandledRejection'));

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
