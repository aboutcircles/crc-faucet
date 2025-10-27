import winston from 'winston';

const { combine, timestamp, printf, colorize, label } = winston.format;

const customFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

export function createLogger(workerName) {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      label({ label: workerName }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      colorize(),
      customFormat
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ 
        filename: `logs/${workerName}.log`,
        level: 'info'
      }),
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error' 
      })
    ]
  });
}