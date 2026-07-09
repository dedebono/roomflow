import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger } from '@nestjs/common';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const now = Date.now();
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;

    this.logger.log(
      JSON.stringify({
        type: 'request',
        requestId,
        method,
        url,
        timestamp: new Date().toISOString(),
      }),
    );

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        const ms = Date.now() - now;
        this.logger.log(
          JSON.stringify({
            type: 'response',
            requestId,
            method,
            url,
            statusCode: res.statusCode,
            durationMs: ms,
            timestamp: new Date().toISOString(),
          }),
        );
      }),
    );
  }
}
