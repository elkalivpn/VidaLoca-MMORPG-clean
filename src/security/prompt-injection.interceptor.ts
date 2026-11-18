import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AntiPromptInjectionService } from './anti-prompt-injection.service';
import { SecurityAuditService } from './security-audit.service';

const SKIP_KEYS = new Set([
  'password',
  'refreshToken',
  'accessToken',
  'cardNumber',
  'secretValue',
  'token',
]);

@Injectable()
export class PromptInjectionInterceptor implements NestInterceptor {
  constructor(
    private readonly promptShield: AntiPromptInjectionService,
    private readonly auditService: SecurityAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<{
        body?: unknown;
        user?: { id?: string };
        ip?: string;
        url?: string;
      }>();
      if (req?.body && typeof req.body === 'object') {
        this.scanAndSanitizeObject(
          req.body as Record<string, unknown>,
          req.user?.id,
          req.ip,
          req.url,
        );
      }
    }
    return next.handle();
  }

  private scanAndSanitizeObject(
    obj: Record<string, unknown>,
    actorId?: string,
    ip?: string,
    path?: string,
    depth = 0,
  ): void {
    if (depth > 6 || !obj || typeof obj !== 'object') return;

    for (const [key, val] of Object.entries(obj)) {
      if (SKIP_KEYS.has(key)) continue;

      if (typeof val === 'string') {
        const result = this.promptShield.inspectInput(val, 4000);
        if (!result.safe) {
          void this.auditService.logEvent({
            actorId: actorId ?? null,
            eventType: 'PROMPT_OR_SCRIPT_INJECTION_BLOCKED',
            severity: 'HIGH',
            target: path ?? key,
            ip,
            details: {
              field: key,
              rules: result.matchedRules,
              riskScore: result.riskScore,
            },
          });
          throw new BadRequestException(
            `Entrada bloqueada por seguridad en el campo '${key}'`,
          );
        }
        obj[key] = result.sanitized;
      } else if (Array.isArray(val)) {
        const arr = val as unknown[];
        for (let i = 0; i < arr.length; i++) {
          const item = arr[i];
          if (typeof item === 'string') {
            const res = this.promptShield.inspectInput(item, 4000);
            if (!res.safe) {
              throw new BadRequestException(
                `Entrada bloqueada por seguridad en '${key}[${i}]'`,
              );
            }
            arr[i] = res.sanitized;
          } else if (item && typeof item === 'object') {
            this.scanAndSanitizeObject(
              item as Record<string, unknown>,
              actorId,
              ip,
              path,
              depth + 1,
            );
          }
        }
      } else if (val && typeof val === 'object') {
        this.scanAndSanitizeObject(
          val as Record<string, unknown>,
          actorId,
          ip,
          path,
          depth + 1,
        );
      }
    }
  }
}
