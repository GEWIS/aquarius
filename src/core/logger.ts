import log4js from 'log4js';
import { env } from '../env';

log4js.configure({
  appenders: {
    out: { type: 'stdout' },
    file: {
      type: 'file',
      filename: 'app/data/app.log',
      maxLogSize: 1048576, // 1 MB
      backups: 3,
      compress: false,
    },
  },
  categories: {
    default: { appenders: ['out', 'file'], level: env.LOG_LEVEL || 'info' },
  },
});
export const logger = log4js.getLogger('🤖');
logger.level = env.LOG_LEVEL || 'info';
