import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MissionsService } from './missions.service';
import {
  CreateCoopMissionDto,
  CreateMissionTemplateDto,
  JoinCoopMissionDto,
  SkipMissionDto,
  StartMissionDto,
  UpdateMissionProgressDto,
  CompleteMissionDto,
} from './dto/missions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, Difficulty, MissionMode } from '@prisma/client';

@Controller('missions')
@UseGuards(AuthGuard('jwt'))
export class MissionsController {
  constructor(private missionsService: MissionsService) {}

  // ─── Templates ───────────────────────────────────────────────────────

  @Get('templates')
  async getTemplates(
    @Query('difficulty') difficulty?: Difficulty,
    @Query('mode') mode?: MissionMode,
    @Query('city') city?: string,
  ) {
    return this.missionsService.getAllTemplates(difficulty, mode, city);
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.missionsService.getTemplateById(id);
  }

  @Post('templates')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async createTemplate(@Body() dto: CreateMissionTemplateDto) {
    return this.missionsService.createTemplate(dto);
  }

  // ─── Player missions & Optional Choice ───────────────────────────────

  @Get('my')
  async getMyMissions(@CurrentUser('id') userId: string) {
    return this.missionsService.getPlayerMissions(userId);
  }

  @Post('start')
  async startMission(
    @CurrentUser('id') userId: string,
    @Body() dto: StartMissionDto,
  ) {
    return this.missionsService.startMission(userId, dto.templateId);
  }

  @Post(':missionId/advance')
  async advanceMission(
    @CurrentUser('id') userId: string,
    @Param('missionId') missionId: string,
  ) {
    return this.missionsService.advanceMission(userId, missionId);
  }

  @Post(':missionId/abandon')
  async abandonMission(
    @CurrentUser('id') userId: string,
    @Param('missionId') missionId: string,
  ) {
    return this.missionsService.abandonMission(userId, missionId);
  }

  @Post('skip')
  async skipMission(
    @CurrentUser('id') userId: string,
    @Body() dto: SkipMissionDto,
  ) {
    return this.missionsService.skipMission(userId, dto.templateId);
  }

  // ─── Online Co-op with Friends ───────────────────────────────────────

  @Get('coop/open')
  async getOpenCoopSquads() {
    return this.missionsService.getOpenCoopSquads();
  }

  @Post('coop/create')
  async createCoopSquad(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCoopMissionDto,
  ) {
    return this.missionsService.createCoopSquad(userId, dto.templateId);
  }

  @Post('coop/join')
  async joinCoopSquad(
    @CurrentUser('id') userId: string,
    @Body() dto: JoinCoopMissionDto,
  ) {
    return this.missionsService.joinCoopSquad(userId, dto.squadCode);
  }

  @Post('coop/:missionId/leave')
  async leaveCoopSquad(
    @CurrentUser('id') userId: string,
    @Param('missionId') missionId: string,
  ) {
    return this.missionsService.leaveCoopSquad(userId, missionId);
  }

  // ─── Admin Progress & Rewards Claim ──────────────────────────────────

  @Post(':missionId/progress')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateProgress(
    @CurrentUser('id') userId: string,
    @Param('missionId') missionId: string,
    @Body() dto: UpdateMissionProgressDto,
  ) {
    return this.missionsService.updateProgress(
      userId,
      missionId,
      dto.progress,
    );
  }

  @Post('claim')
  async claimReward(
    @CurrentUser('id') userId: string,
    @Body() dto: CompleteMissionDto,
  ) {
    return this.missionsService.claimReward(userId, dto.missionId);
  }
}
