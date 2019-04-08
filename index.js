// index.js

// Dependencies
const __ = require('@dealerslink/lodash-extended');
const fs = require('fs');
const LogstashUDP = require('winston3-logstash-udp').LogstashUDP;
const winston = require('winston');
const { format } = winston;

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
      options: {}
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
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      transports.push(new winston.transports.Console({
        level: 'debug',
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
      transports: transports
    };

    this.sqlOptions = {
      exitOnError: false,
      transports: transports
    };

    // Add logstash logging when it has an included configuration
    if (config.logstash) {
      this.options.transports.push(new LogstashUDP({
        port: config.logstash.port,
        host: config.logstash.host,
        appName: config.logstash.appName,
        level: 'info',
        json: true,
        logstash: true,
        meta: false
      }));
    }

    // Add logstash logging for SQL Logger when it has an included configuration
    if (config.logstashSQL) {
      this.sqlOptions.transports.push(new LogstashUDP({
        port: config.logstashSQL.port,
        host: config.logstashSQL.host,
        appName: config.logstashSQL.appName,
        level: 'info',
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
    // this.log = winston.createLogger(this.options);

    this.loggers = new winston.Container();
    this.loggers.add('default', this.options);
    this.loggers.add('sql', this.sqlOptions);
    this.log = this.loggers.get('default');

    // Mixin to replacement to strip empty logs in debug and error
    this.addBetterLoggingMixins(this.log);
    this.addBetterLoggingMixins(this.loggers.get('sql'))
  }

  // Adds Mixin replacement to strip logs which contain empty string or objects
  addBetterLoggingMixins(log) {
    log.oldSilly = log.silly;
    log.oldInfo = log.info;
    log.oldDebug = log.debug;
    log.oldWarn = log.warn;
    log.oldError = log.error;
    log.genLog = ((replaceFn, ...params) => {
      if (typeof params[0] !== 'string') {
        if (params[0] instanceof Error) {
          params[0] = JSON.stringify(params[0], Object.getOwnPropertyNames(params[0]));
        } else {
          params[0] = JSON.stringify(params[0]);
        }
      }
      if (params[0] !== '{}' && params[0] !== '') {
        replaceFn(...params);
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
    return JSON.stringify(out);
  }

  handleError(err) {
    if (this.log) {
      this.log.error(err);
    }
  }
}

module.exports = Logger;
