import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SkillCategory } from '@prisma/client';
import { CreateSkillDto } from './dto/skills.dto';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

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

  async trainSkill(userId: string, skillId: string, xpAmount = 50) {
    const player = await this.getPlayerOrThrow(userId);
    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });

    if (!skill) throw new NotFoundException('Skill not found');

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

    const newXp = playerSkill.xp + xpAmount;
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
