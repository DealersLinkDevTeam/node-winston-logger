// index.js

// Dependencies
const __ = require('@dealerslink/lodash-extended');
const fs = require('fs');
const winston = require('winston');
const LogstashUDP = require('winston3-logstash-udp').LogstashUDP;

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

    const transports = [
      new winston.transports.File({
        filename: `${this.logDir}/info.log`,
        name: 'info-log',
        level: 'info',
        format: winston.format.printf(this.formatter)
      }),
      new winston.transports.File({
        filename: `${this.logDir}/error.log`,
        name: 'error-log',
        level: 'error',
        format: winston.format.printf(this.formatter)
      })
    ];

    // Optimization -- Add console logging and debug file if not in production
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      transports.push(new winston.transports.Console({
        level: 'debug',
        format: winston.format.printf(this.formatter)
      }));
      transports.push(new winston.transports.File({
        filename: `${this.logDir}/debug.log`,
        name: 'debug-log',
        level: 'debug',
        format: winston.format.printf(this.formatter)
      }));
    }

    // Add logstash logging when it has an included configuration
    if (config.logstash) {
      transports.push(new LogstashUDP({
        port: config.logstash.port,
        host: config.logstash.host,
        appName: config.logstash.appName,
        level: 'info',
        format: winston.format.logstash()
      }));
    }

    this.options = {
      // json: true,
      // logstash: true,
      // format: winston.format.combine(winston.format.printf(this.jsonformatter), winston.format.logstash()),
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
    this.log.oldDebug = this.log.debug;
    this.log.oldError = this.log.error;
    this.log.genLog = ((replaceFn, ...params) => {
      if (typeof params[0] !== 'string') {
        params[0] = JSON.stringify(params[0]);
      }
      if (params[0] !== '{}' && params[0] !== '') {
        replaceFn(...params);
      }
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

  // jsonformatter(options) {
  //   const date = new Date().toISOString();
  //   const obj = {
  //     date: date,
  //     level: options.level.toUpperCase()
  //   };
  //   // Merge message if it is an object -- otherwise add message property
  //   if (typeof options.message === 'object') {
  //     __.merge(obj, object.message);
  //   } else {
  //     obj.message = options.message;
  //   }
  //   return JSON.stringify(obj);
  // }

  handleError(err) {
    if (this.log) {
      this.log.error(err);
    }
  }
}

module.exports = Logger;
