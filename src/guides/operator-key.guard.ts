import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class OperatorKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configuredKey = process.env.OPERATOR_API_KEY;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const suppliedKey = request.headers['x-operator-key'];

    return Boolean(
      configuredKey
      && typeof suppliedKey === 'string'
      && suppliedKey === configuredKey,
    );
  }
}
