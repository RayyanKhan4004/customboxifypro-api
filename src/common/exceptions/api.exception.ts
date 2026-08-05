import { HttpException, HttpStatus } from '@nestjs/common';

import { ErrorCodes, ErrorCode } from '../constants/error-codes';

export interface ApiErrorDetail {
  field?: string;
  message?: string;
}

export class ApiException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message, statusCode);
  }

  static validation(details: ApiErrorDetail[]): ApiException {
    return new ApiException(
      ErrorCodes.VALIDATION_FAILED,
      'The request payload is invalid.',
      HttpStatus.BAD_REQUEST,
      details,
    );
  }

  static invalid(
    code: ErrorCode,
    message: string,
    details: ApiErrorDetail[] = [],
  ): ApiException {
    return new ApiException(code, message, HttpStatus.BAD_REQUEST, details);
  }

  static notFound(code: ErrorCode, message: string): ApiException {
    return new ApiException(code, message, HttpStatus.NOT_FOUND);
  }

  static conflict(code: ErrorCode, message: string): ApiException {
    return new ApiException(code, message, HttpStatus.CONFLICT);
  }

  static forbidden(
    message = 'You do not have permission to perform this action.',
  ): ApiException {
    return new ApiException(
      ErrorCodes.FORBIDDEN,
      message,
      HttpStatus.FORBIDDEN,
    );
  }

  static unauthorized(
    message = 'Authentication is required.',
    code: ErrorCode = ErrorCodes.UNAUTHORIZED,
  ): ApiException {
    return new ApiException(code, message, HttpStatus.UNAUTHORIZED);
  }
}
