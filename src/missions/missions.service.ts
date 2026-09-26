import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MissionStatus, Difficulty } from '@prisma/client';
import { CreateMissionTemplateDto } from './dto/missions.dto';

@Injectable()
export class MissionsService {
  constructor(private prisma: PrismaService) {}

  // ─── Templates (Admin) ───────────────────────────────────────────────

  async createTemplate(dto: CreateMissionTemplateDto) {
    return this.prisma.missionTemplate.create({
      data: {
        title: dto.title,
        description: dto.description,
        difficulty: dto.difficulty,
        rewardEuros: dto.rewardEuros,
        rewardXp: dto.rewardXp,
        requirement: dto.requirement ?? undefined,
      },
    });
  }

  async getAllTemplates(difficulty?: Difficulty) {
    return this.prisma.missionTemplate.findMany({
      where: difficulty ? { difficulty } : undefined,
      orderBy: { difficulty: 'asc' },
    });
  }

  async getTemplateById(id: string) {
    const template = await this.prisma.missionTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Mission template not found');
    return template;
  }

  // ─── Player missions ─────────────────────────────────────────────────

  async getPlayerMissions(userId: string) {
    const player = await this.getPlayerOrThrow(userId);

    return this.prisma.playerMission.findMany({
      where: { playerId: player.id },
      include: { template: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  async startMission(userId: string, templateId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const template = await this.getTemplateById(templateId);

    // Prevent starting the same mission twice while active
    const active = await this.prisma.playerMission.findFirst({
      where: {
        playerId: player.id,
        templateId,
        status: { in: [MissionStatus.PENDING, MissionStatus.IN_PROGRESS] },
      },
    });

    if (active) {
      throw new BadRequestException('You already have this mission active');
    }

    // Soft level gate based on difficulty
    const minLevel: Record<Difficulty, number> = {
      EASY: 1,
      MEDIUM: 5,
      HARD: 15,
      SUICIDE: 30,
    };

    if (player.level < minLevel[template.difficulty]) {
      throw new ForbiddenException(
        `You need level ${minLevel[template.difficulty]} for this mission`,
      );
    }

    return this.prisma.playerMission.create({
      data: {
        playerId: player.id,
        templateId,
        status: MissionStatus.IN_PROGRESS,
        progress: 0,
      },
      include: { template: true },
    });
  }

  async updateProgress(userId: string, missionId: string, progress: number) {
    const player = await this.getPlayerOrThrow(userId);
    const mission = await this.prisma.playerMission.findFirst({
      where: { id: missionId, playerId: player.id },
      include: { template: true },
    });

    if (!mission) throw new NotFoundException('Mission not found');
    if (mission.status !== MissionStatus.IN_PROGRESS) {
      throw new BadRequestException('Mission is not in progress');
    }

    const newProgress = Math.min(100, Math.max(0, progress));
    const status =
      newProgress >= 100 ? MissionStatus.COMPLETED : MissionStatus.IN_PROGRESS;

    return this.prisma.playerMission.update({
      where: { id: missionId },
      data: {
        progress: newProgress,
        status,
        completedAt: status === MissionStatus.COMPLETED ? new Date() : undefined,
      },
      include: { template: true },
    });
  }

  async claimReward(userId: string, missionId: string) {
    const player = await this.getPlayerOrThrow(userId);
    const mission = await this.prisma.playerMission.findFirst({
      where: { id: missionId, playerId: player.id },
      include: { template: true },
    });

    if (!mission) throw new NotFoundException('Mission not found');
    if (mission.status !== MissionStatus.COMPLETED) {
      throw new BadRequestException('Mission is not completed yet');
    }

    // Prevent double claim
    const alreadyClaimed = await this.prisma.completedMission.findFirst({
      where: {
        playerId: player.id,
        missionId: mission.templateId,
        rewardClaimed: true,
      },
    });

    if (alreadyClaimed) {
      throw new BadRequestException('Reward already claimed');
    }

    const { rewardEuros, rewardXp } = mission.template;

    return this.prisma.$transaction(async (tx) => {
      // Mark mission as claimed
      await tx.playerMission.update({
        where: { id: missionId },
        data: { status: MissionStatus.CLAIMED },
      });

      // Record completion
      await tx.completedMission.create({
        data: {
          playerId: player.id,
          missionId: mission.templateId,
          rewardClaimed: true,
        },
      });

      // Give rewards
      const newXp = player.xp + rewardXp;
      const newLevel = Math.floor(newXp / 1000) + 1;

      const updatedPlayer = await tx.player.update({
        where: { id: player.id },
        data: {
          euros: { increment: rewardEuros },
          xp: newXp,
          level: newLevel > player.level ? newLevel : player.level,
        },
      });

      // Log transaction
      await tx.transactionLog.create({
        data: {
          playerId: player.id,
          type: 'EARN',
          amount: rewardEuros,
          currency: 'EUR',
          reason: `Mission reward: ${mission.template.title}`,
          reference: missionId,
        },
      });

      return {
        mission: { ...mission, status: MissionStatus.CLAIMED },
        rewards: { euros: rewardEuros, xp: rewardXp },
        player: {
          euros: updatedPlayer.euros,
          xp: updatedPlayer.xp,
          level: updatedPlayer.level,
        },
      };
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
    });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }
}
