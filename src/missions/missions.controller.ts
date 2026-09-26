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
  CreateMissionTemplateDto,
  StartMissionDto,
  UpdateMissionProgressDto,
  CompleteMissionDto,
} from './dto/missions.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, Difficulty } from '@prisma/client';

@Controller('missions')
@UseGuards(AuthGuard('jwt'))
export class MissionsController {
  constructor(private missionsService: MissionsService) {}

  // ─── Templates ───────────────────────────────────────────────────────

  @Get('templates')
  async getTemplates(@Query('difficulty') difficulty?: Difficulty) {
    return this.missionsService.getAllTemplates(difficulty);
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

  // ─── Player missions ─────────────────────────────────────────────────

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

  @Post(':missionId/progress')
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
