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

    // Add logstash logging when it has an included configuration
    if (config.logstash) {
      transports.push(new LogstashUDP({
        port: config.logstash.port,
        host: config.logstash.host,
        appName: config.logstash.appName,
        level: 'info',
        json: true,
        logstash: true,
        meta: false
      }));
    }

    this.options = {
      exitOnError: false,
      transports: transports
    };

    // Create log folder if it does not already exist
    if (!fs.existsSync(this.loggingConfig.logDir)) {
      console.log('Creating log folder');
      fs.mkdirSync(this.loggingConfig.logDir);
    }

    // Merge options from config into this object
    this.option = __.assign(this.options, this.loggingConfig.options);
    this.log = winston.createLogger(this.options);

    // Mixin to replacement to strip empty logs in debug and error
    this.log.oldSilly = this.log.silly;
    this.log.oldInfo = this.log.info;
    this.log.oldDebug = this.log.debug;
    this.log.oldError = this.log.error;
    this.log.genLog = ((replaceFn, ...params) => {
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
    this.log.silly = ((...params) => {
      this.log.genLog(this.log.oldSilly, ...params);
    });
    this.log.info = ((...params) => {
      this.log.genLog(this.log.oldInfo, ...params);
    });
    this.log.debug = ((...params) => {
      this.log.genLog(this.log.oldDebug, ...params);
    });
    this.log.error = ((...params) => {
      this.log.genLog(this.log.oldError, ...params);
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
