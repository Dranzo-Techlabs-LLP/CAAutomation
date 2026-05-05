import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { Team } from './team.entity';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {}

  async create(firmId: string, dto: CreateTeamDto, actorUserId: string): Promise<TeamResponseDto> {
    const team = this.teamRepository.create({
      firmId,
      name: dto.name,
      description: dto.description,
      leadUserId: dto.leadUserId,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    return this.toResponse(await this.teamRepository.save(team));
  }

  async list(firmId: string): Promise<TeamResponseDto[]> {
    const teams = await this.teamRepository.find({
      where: { firmId, isActive: true },
      order: { name: 'ASC' },
    });
    return teams.map((team) => this.toResponse(team));
  }

  async update(firmId: string, id: string, dto: Partial<CreateTeamDto>, actorUserId: string): Promise<TeamResponseDto> {
    const team = await this.teamRepository.findOne({ where: { firmId, id } });
    if (!team) throw new NotFoundException('Team not found');
    if (dto.name !== undefined) team.name = dto.name;
    if (dto.description !== undefined) team.description = dto.description;
    if (dto.leadUserId !== undefined) team.leadUserId = dto.leadUserId;
    team.updatedBy = actorUserId;
    return this.toResponse(await this.teamRepository.save(team));
  }

  async delete(firmId: string, id: string): Promise<void> {
    const team = await this.teamRepository.findOne({ where: { firmId, id } });
    if (!team) throw new NotFoundException('Team not found');
    team.isActive = false;
    await this.teamRepository.save(team);
  }

  private toResponse(team: Team): TeamResponseDto {
    return {
      id: team.id,
      firmId: team.firmId,
      name: team.name,
      description: team.description,
      leadUserId: team.leadUserId,
      lastAssignedUserId: team.lastAssignedUserId,
      isActive: team.isActive,
    };
  }
}
