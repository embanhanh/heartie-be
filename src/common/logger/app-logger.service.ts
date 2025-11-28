import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';

export interface LogMetadata {
  [key: string]: unknown;
}

@Injectable()
export class AppLogger extends ConsoleLogger {
  constructor() {
    super('App');
  }

  setLogLevels(levels: LogLevel[]) {
    super.setLogLevels(levels);
  }

  log(message: string, context?: string, metadata?: LogMetadata) {
    super.log(this.format(message, metadata), context);
  }

  error(message: string, trace?: string, context?: string, metadata?: LogMetadata) {
    super.error(this.format(message, metadata), trace, context);
  }

  warn(message: string, context?: string, metadata?: LogMetadata) {
    super.warn(this.format(message, metadata), context);
  }

  debug(message: string, context?: string, metadata?: LogMetadata) {
    super.debug(this.format(message, metadata), context);
  }

  verbose(message: string, context?: string, metadata?: LogMetadata) {
    super.verbose(this.format(message, metadata), context);
  }

  private format(message: string, metadata?: LogMetadata): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return message;
    }

    try {
      return `${message} ${JSON.stringify(metadata)}`;
    } catch {
      return message;
    }
  }
}
