// index.js

// Dependencies
const fs = require('fs');
const __ = require('@dealerslink/lodash-extended');
const winston = require('winston');
const { format } = winston;
const LogstashTransport = require('./lib/logstashTransport');
const util = require('util');

/**
 * A utility class to wrap Winston logging
 * @class Logger
 * @param {object} config - A global configuration object that may contain options on how to initialize the logger
 * @example
 * let logger = new logger(config);
 */
class Logger {
  constructor(config) {
    config = config || {};
    const defaultLogging = {
      logDir: './logs',
      options: {},
      verbose: false
    };
    this.loggingConfig = __.assign({}, defaultLogging, config.logging || {});
    this.logDir = this.loggingConfig .logDir || './logs';

    const transports = [];
    const frmt = format((info) => {
      const msg = {};
      if (info.message) {
        msg['@message'] = info.message;
      }
      if (info.timestamp) {
        msg['@timestamp'] = info.timestamp;
      }
      msg['@fields'] = info;
      return JSON.stringify(info);
    });

    // Optimization -- Add console logging and debug file if not in production
    const env = process.env.NODE_ENV;
    if (env !== 'production' && env !== 'test') {
      const lvl = (this.loggingConfig.verbose) ? 'silly' : 'debug';
      transports.push(new winston.transports.Console({
        level: lvl,
        format: format.printf(this.formatter)
      }));
      transports.push(new winston.transports.File({
        filename: `${this.logDir}/debug.log`,
        name: 'debug-log',
        level: 'debug',
        format: format.printf(this.formatter)
      }));
    }

    transports.push(new winston.transports.File({
      filename: `${this.logDir}/info.log`,
      name: 'info-log',
      level: 'info',
      format: format.printf(this.formatter)
    }));
    transports.push(new winston.transports.File({
      filename: `${this.logDir}/error.log`,
      name: 'error-log',
      level: 'error',
      format: format.printf(this.formatter)
    }));

    this.options = {
      exitOnError: false,
      transports: transports.slice(0)
    };

    this.sqlOptions = {
      exitOnError: false,
      transports: transports.slice(0)
    };

    this.requestOptions = {
      exitOnError: false,
      transports: transports.slice(0)
    };

    // Add logstash logging when it has an included configuration
    if (config.logstash) {
      this.options.transports.push(new LogstashTransport({
        port: config.logstash.port,
        host: config.logstash.host,
        appName: config.logstash.appName,
        mode: config.logstash.mode,
        level: 'info',
        json: true,
        logstash: true,
        meta: false
      }));
    }

    // Add logstash logging for SQL Logger when it has an included configuration
    if (config.logstashSQL) {
      this.sqlOptions.transports.push(new LogstashTransport({
        port: config.logstashSQL.port,
        host: config.logstashSQL.host,
        appName: config.logstashSQL.appName,
        mode: config.logstashSQL.mode,
        trailingLineFeed: true,
        level: 'debug',
        json: true,
        logstash: true,
        meta: false
      }));
    }

    // Add logstash logging for SQL Logger when it has an included configuration
    if (config.logstashRequests) {
      this.requestOptions.transports.push(new LogstashTransport({
        port: config.logstashRequests.port,
        host: config.logstashRequests.host,
        appName: config.logstashRequests.appName,
        mode: config.logstashRequests.mode,
        trailingLineFeed: true,
        level: 'debug',
        json: true,
        logstash: true,
        meta: false
      }));
    }

    // Create log folder if it does not already exist
    if (!fs.existsSync(this.loggingConfig.logDir)) {
      console.log('Creating log folder');
      fs.mkdirSync(this.loggingConfig.logDir);
    }

    // Merge options from config into this object
    this.option = __.assign(this.options, this.loggingConfig.options);
    this.sqlOptions = __.assign(this.sqlOptions, this.loggingConfig.options);
    this.requestOptions = __.assign(this.requestOptions, this.loggingConfig.options);
    // this.log = winston.createLogger(this.options);

    this.loggers = new winston.Container();
    this.loggers.add('default', this.options);
    this.loggers.add('sql', this.sqlOptions);
    this.loggers.add('requests', this.requestOptions);
    this.log = this.loggers.get('default');
    this.sqlLog = this.loggers.get('sql');
    this.requestsLog = this.loggers.get('requests');

    // Mixin to replacement to strip empty logs in debug and error
    this.addBetterLoggingMixins(this.log);
    this.addBetterLoggingMixins(this.sqlLog);
    this.addBetterLoggingMixins(this.requestsLog);
  }

  // Adds Mixin replacement to strip logs which contain empty string or objects
  addBetterLoggingMixins(log) {
    log.oldSilly = log.silly;
    log.oldInfo = log.info;
    log.oldDebug = log.debug;
    log.oldWarn = log.warn;
    log.oldError = log.error;
    log.genLog = ((replaceFn, ...params) => {
      if (params[0]) {
        const data = Object.assign({}, params[0]);
        if (typeof params[0] !== 'string') {
          if (params[0] instanceof Error) {
            params[0] = JSON.stringify(params[0], Object.getOwnPropertyNames(params[0]));
          } else {
            params[0] = JSON.stringify(params[0]);
          }
        }
        if (data !== '{}' && data !== '') {
          replaceFn(...params);
        }
      }
    });
    log.silly = ((...params) => {
      log.genLog(log.oldSilly, ...params);
    });
    log.info = ((...params) => {
      log.genLog(log.oldInfo, ...params);
    });
    log.debug = ((...params) => {
      log.genLog(log.oldDebug, ...params);
    });
    log.warn = ((...params) => {
      log.genLog(log.oldWarn, ...params);
    });
    log.error = ((...params) => {
      log.genLog(log.oldError, ...params);
    });
  }

  formatter(options) {
    let message = options.message;
    if (!message) {
      message = JSON.parse(options[Symbol.for('message')])['@message'];
    }
    return `${new Date().toISOString()} [${options.level.toUpperCase()}]: ${message}`;
  }

  logstashFormatter(options) {
    let message = options.message;
    if (!message) {
      message = JSON.parse(options[Symbol.for('message')])['@message'];
    }
    const out = {};
    out['@message'] = message;
    out['@timestamp'] = new Date().toISOString();
    out['@fields'] = options;
    let oustr;
    try {
      outstr = JSON.strinify(out);
    } catch {
      outstr = util.inspect(out, { depth: null });
    }
    return outstr;
  }

  handleError(err) {
    if (this.log) {
      this.log.error(err);
    }
  }
}

module.exports = Logger;
