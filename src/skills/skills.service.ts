import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SkillCategory } from '@prisma/client';
import { AntiCheatService } from '../security/anti-cheat.service';
import { CreateSkillDto } from './dto/skills.dto';

@Injectable()
export class SkillsService {
  private readonly MAX_TRAINING_XP = 50;
  private readonly TRAIN_COOLDOWN_MS = 30_000;

  constructor(
    private prisma: PrismaService,
    @Optional() private antiCheat?: AntiCheatService,
  ) {}

  async getAllSkills(category?: SkillCategory) {
    return this.prisma.skill.findMany({
      where: category ? { category } : undefined,
      orderBy: { category: 'asc' },
    });
  }

  async getPlayerSkills(userId: string) {
    const player = await this.getPlayerOrThrow(userId);
    return this.prisma.playerSkill.findMany({
      where: { playerId: player.id },
      include: { skill: true },
      orderBy: { level: 'desc' },
    });
  }

  async createSkill(dto: CreateSkillDto) {
    return this.prisma.skill.create({ data: dto });
  }

  async trainSkill(userId: string, skillId: string, requestedXp = 50) {
    const player = await this.getPlayerOrThrow(userId);
    this.antiCheat?.assertActionCooldown(
      player.id,
      'skill:train',
      this.TRAIN_COOLDOWN_MS,
      'Debes descansar antes de volver a entrenar una habilidad',
    );

    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });

    if (!skill) throw new NotFoundException('Skill not found');

    const safeXp = Math.min(
      this.MAX_TRAINING_XP,
      Math.max(10, Math.floor(Number.isFinite(requestedXp) ? requestedXp : 50)),
    );

    let playerSkill = await this.prisma.playerSkill.findUnique({
      where: {
        playerId_skillId: { playerId: player.id, skillId },
      },
    });

    if (!playerSkill) {
      // Unlock skill at level 1
      playerSkill = await this.prisma.playerSkill.create({
        data: {
          playerId: player.id,
          skillId,
          level: 1,
          xp: 0,
        },
      });
    }

    if (playerSkill.level >= skill.maxLevel) {
      throw new BadRequestException('Skill already at max level');
    }

    const newXp = playerSkill.xp + safeXp;
    // Simple curve: 100 xp per level
    const xpForNext = playerSkill.level * 100;
    let newLevel = playerSkill.level;
    let remainingXp = newXp;

    if (newXp >= xpForNext) {
      newLevel = Math.min(skill.maxLevel, playerSkill.level + 1);
      remainingXp = newXp - xpForNext;
    }

    return this.prisma.playerSkill.update({
      where: { id: playerSkill.id },
      data: {
        level: newLevel,
        xp: remainingXp,
      },
      include: { skill: true },
    });
  }

  private async getPlayerOrThrow(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }
}
