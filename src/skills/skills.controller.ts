import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkillsService } from './skills.service';
import { CreateSkillDto, TrainSkillDto } from './dto/skills.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, SkillCategory } from '@prisma/client';

@Controller('skills')
@UseGuards(AuthGuard('jwt'))
export class SkillsController {
  constructor(private skillsService: SkillsService) {}

  @Get()
  async getAll(@Query('category') category?: SkillCategory) {
    return this.skillsService.getAllSkills(category);
  }

  @Get('my')
  async getMySkills(@CurrentUser('id') userId: string) {
    return this.skillsService.getPlayerSkills(userId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateSkillDto) {
    return this.skillsService.createSkill(dto);
  }

  @Post('train')
  async train(
    @CurrentUser('id') userId: string,
    @Body() dto: TrainSkillDto,
  ) {
    return this.skillsService.trainSkill(
      userId,
      dto.skillId,
      dto.xpAmount ?? 50,
    );
  }
}
