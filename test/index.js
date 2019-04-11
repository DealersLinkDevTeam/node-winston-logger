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
        port: 5025,
        appName: 'test',
        mode: 'udp4'
      },
      logstashRequests: {
        host: 'localhost',
        port: 5075,
        appName: 'test',
        mode: 'tcp4'
      },
      logstashSQL: {
        host: 'localhost',
        port: 5100,
        appName: 'test',
        mode: 'tcp4'        
      }
    };
    logger = await new Logger(config);
    log = logger.log;
  });

  it('constructor', () => {
    expect(logger).to.be.instanceof(Logger);
  });

  it('check loggers container', () => {
    expect(logger.loggers.get('default')).to.not.equal(null);
    expect(logger.loggers.get('sql')).to.not.equal(null);
  });

  it('log functions', () => {
    expect(log.log).to.be.a('function');
    expect(logger.loggers.get('sql').log).to.be.a('function');
  });

  it('send blank', () => {
    log.silly('');
    log.debug('');
    log.info('');
    log.warn('');
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
