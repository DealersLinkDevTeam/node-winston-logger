// index.js

// Dependencies
const __ = require('@dealerslink/lodash-extended');
const fs = require('fs');
const winston = require('winston');
const LogstashUDP = require('winston-logstash-udp').LogstashUDP;

/**
 * A utility class to wrap Winston logging
 * @class Logger
 * @param {object} config - A global configuration object that may contain options on how to initialize the logger
 * @example
 * let logger = new logger(config);
 */
class Logger {
  constructor(config) {
    this.logDir = config.logging.logDir || './logs';

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
        json: true,
        logstash: true,
        level: 'info',
        format: winston.format.json()
      }));
    }

    this.options = {
      exitOnError: false,
      transports: transports,
      format: winston.format.printf(this.formatter),
      json: true,
      logstash: true
    };

    // Create log folder if it does not already exist
    if (!fs.existsSync(config.logging.logDir)) {
      console.log('Creating log folder');
      fs.mkdirSync(config.logging.logDir);
    }

    // Merge options from config into this object
    this.option = __.assign(this.options, config.logging.options);
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
    return `${new Date().toISOString()} [${options.level.toUpperCase()}]: ${options.message}`;
  }

  handleError(err) {
    if (this.log) {
      this.log.error(err);
    }
  }
}

module.exports = Logger;
