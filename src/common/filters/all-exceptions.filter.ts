import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Error as MongooseError } from 'mongoose';

import { ErrorCodes, ErrorCode } from '../constants/error-codes';
import { ApiException, ApiErrorDetail } from '../exceptions/api.exception';
import { AppLogger } from '../logger/logger.service';
import { RequestContextService } from '../logger/request-context.service';

interface ErrorBody {
  success: false;
  statusCode: number;
  code: string;
  message: string;
  details: ApiErrorDetail[];
  requestId: string;
}

interface StatusToCodeMapping {
  [status: number]: ErrorCode;
}

const STATUS_CODES: StatusToCodeMapping = {
  [HttpStatus.BAD_REQUEST]: ErrorCodes.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCodes.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCodes.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCodes.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCodes.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCodes.RATE_LIMITED,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCodes.PAYLOAD_TOO_LARGE,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCodes.VALIDATION_FAILED,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: AppLogger,
    private readonly context: RequestContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host
      .switchToHttp()
      .getRequest<{ method: string; url: string }>();
    const requestId = this.context.requestId();

    const body = this.toErrorBody(exception, requestId);

    if (body.statusCode >= 500) {
      this.logger.error(
        `Unhandled ${exception instanceof Error ? exception.constructor.name : 'exception'}: ${body.message}`,
        {
          statusCode: body.statusCode,
          code: body.code,
          method: request.method,
          path: request.url,
        },
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`Request failed: ${body.code}`, {
        statusCode: body.statusCode,
        method: request.method,
        path: request.url,
      });
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, requestId: string): ErrorBody {
    if (exception instanceof ApiException) {
      return {
        success: false,
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      let details: ApiErrorDetail[] = [];

      if (typeof exceptionResponse === 'string') {
        return {
          success: false,
          statusCode: status,
          code: STATUS_CODES[status] ?? ErrorCodes.INTERNAL_ERROR,
          message: exceptionResponse,
          details,
          requestId,
        };
      }

      const payload = exceptionResponse as {
        message?: string | string[] | object;
      };
      let message = 'The request failed.';
      if (typeof payload.message === 'string') {
        message = payload.message;
      } else if (Array.isArray(payload.message)) {
        details = this.parseValidationMessages(payload.message);
        message = 'The request payload is invalid.';
      }

      return {
        success: false,
        statusCode: status,
        code: STATUS_CODES[status] ?? ErrorCodes.INTERNAL_ERROR,
        message,
        details,
        requestId,
      };
    }

    if (this.isMongooseValidationError(exception)) {
      const details: ApiErrorDetail[] = Object.entries(exception.errors).map(
        ([field, err]) => ({
          field,
          message: err.message,
        }),
      );
      return {
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        code: ErrorCodes.VALIDATION_FAILED,
        message: 'The data failed schema validation.',
        details,
        requestId,
      };
    }

    if (this.isDuplicateKeyError(exception)) {
      return {
        success: false,
        statusCode: HttpStatus.CONFLICT,
        code: ErrorCodes.CONFLICT,
        message: 'A record with the same unique value already exists.',
        details: [],
        requestId,
      };
    }

    return {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'An unexpected error occurred. Please try again later.',
      details: [],
      requestId,
    };
  }

  private parseValidationMessages(messages: string[]): ApiErrorDetail[] {
    return messages.map((raw) => {
      const separator = raw.indexOf(':');
      if (separator > 0) {
        return {
          field: raw.slice(0, separator).trim(),
          message: raw.slice(separator + 1).trim(),
        };
      }
      return { message: raw };
    });
  }

  private isMongooseValidationError(
    exception: unknown,
  ): exception is MongooseError.ValidationError {
    return exception instanceof MongooseError.ValidationError;
  }

  private isDuplicateKeyError(exception: unknown): boolean {
    return (
      exception instanceof Error &&
      'code' in exception &&
      (exception as { code?: number }).code === 11000
    );
  }
}
