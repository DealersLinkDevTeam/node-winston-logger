// test/index.js

// Dependancies
const chai = require('chai');
const expect = chai.expect;
const Logger = require('../');

class WeirdError extends Error {
  constructor(message) {
    super(message);
  }
}

describe('Logger Wrapper', () => {
  let logger;
  let log;

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
        port: 8125,
        appName: 'test'
      }
    };
    logger = await new Logger(config);
    log = logger.log;
  });

  it('constructor', () => {
    expect(logger).to.be.instanceof(Logger);
  });

  it('log functions', () => {
    expect(log.log).to.be.a('function');
  });

  it('send blank', () => {
    log.error('');
  });

  it('send text', () => {
    log.error('Test Error');
  });

  it('send object', () => {
    log.error({ garbage: 'Test Error'});
  });

  it('send error', () => {
    try {
      throw new WeirdError('Something went wrong.');
    } catch(err) {
      log.error(err);
    }
  });
});
