// test/index.js

// Dependancies
const chai = require('chai');
const expect = chai.expect;
const Logger = require('../');

describe('Logger Wrapper', () => {
  let logger;

  before(async() => {
    const config = {
      logging: {
        // Logging Configuration
        logDir: './logs',
        options: {
          json: false,
          maxsize: '10000000',
          maxFiles: '10',
          level: 'silly'
        }
      },
      logstash: {
        host: 'localhost',
        port: 5000,
        appName: 'test'
      }
    };
    logger = await new Logger(config);
  });

  it('constructor', () => {
    expect(logger).to.be.instanceof(Logger);
  });

  it('log functions', () => {
    expect(logger.log.log).to.be.a('function');
  });
});
