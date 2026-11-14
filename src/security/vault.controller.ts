import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AntiPromptInjectionService } from './anti-prompt-injection.service';
import {
  InspectPromptDto,
  StoreSensitiveRecordDto,
  TokenizeCardDto,
} from './dto/security.dto';
import { VaultService } from './vault.service';

@Controller('vault')
@UseGuards(AuthGuard('jwt'))
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Post('cards')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async tokenizeCard(
    @CurrentUser('id') userId: string,
    @Body() dto: TokenizeCardDto,
    @Req() req: Request,
  ) {
    return this.vaultService.tokenizeCard(userId, dto, req.ip);
  }

  @Get('cards')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async listMaskedCards(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    return this.vaultService.listMaskedRecords(userId, req.ip);
  }

  @Post('sensitive')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async storeSensitive(
    @CurrentUser('id') userId: string,
    @Body() dto: StoreSensitiveRecordDto,
    @Req() req: Request,
  ) {
    return this.vaultService.storeSensitiveRecord(userId, dto, req.ip);
  }

  @Delete('records/:vaultToken')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async revokeRecord(
    @CurrentUser('id') userId: string,
    @Param('vaultToken') vaultToken: string,
    @Req() req: Request,
  ) {
    return this.vaultService.revokeRecord(userId, vaultToken, req.ip);
  }
}

@Controller('security')
@UseGuards(AuthGuard('jwt'))
export class SecurityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptShield: AntiPromptInjectionService,
  ) {}

  @Post('inspect-prompt')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  inspectPrompt(@Body() dto: InspectPromptDto) {
    return this.promptShield.inspectInput(dto.text);
  }

  @Get('audit')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getSecurityAuditOverview() {
    const [recentAudit, recentIncidents, vaultCount] = await Promise.all([
      this.prisma.securityAuditLog.findMany({
        take: 25,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.antiCheatIncident.findMany({
        take: 25,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vaultRecord.count({ where: { isRevoked: false } }),
    ]);

    return {
      status: 'HARDENED',
      protections: {
        helmetHeaders: true,
        jwtTokenTypeIsolation: true,
        refreshTokenSha256Rotation: true,
        bruteForceLockout: true,
        antiCheatServerAuthoritative: true,
        antiPromptInjectionShield: true,
        databaseRlsHardened: true,
        vaultEnvelopeEncryption: 'AES-256-GCM + HKDF-SHA256',
        pciCvvStorageForbidden: true,
      },
      metrics: {
        activeVaultRecords: vaultCount,
        recentSecurityEvents: recentAudit.length,
        recentAntiCheatIncidents: recentIncidents.length,
      },
      recentAudit,
      recentIncidents,
    };
  }
}
