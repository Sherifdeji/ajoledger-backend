import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface AjoLedgerResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Wraps every successful controller response in the AjoLedger standard envelope:
 * { success: true, message: string, data: T }
 *
 * Controllers may return either a plain value (becomes `data`) or an object
 * with `{ message, data }` to customise the response message.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  AjoLedgerResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<AjoLedgerResponse<T>> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (
          value !== null &&
          typeof value === 'object' &&
          'message' in value &&
          'data' in value
        ) {
          const structured = value as { message: string; data: T };
          return {
            success: true,
            message: structured.message,
            data: structured.data,
          };
        }

        return {
          success: true,
          message: 'Operation completed successfully.',
          data: value as T,
        };
      }),
    );
  }
}
