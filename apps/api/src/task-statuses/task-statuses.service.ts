import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTaskStatusDto, ReorderStatusesDto, UpdateTaskStatusEntityDto } from './dto/task-status.dto';
import { TaskStatusEntity } from './task-status.entity';

const DEFAULT_STATUSES: { code: string; label: string; color: string; sortOrder: number; isInitial?: boolean; isTerminal?: boolean }[] = [
  { code: 'unassigned', label: 'Unassigned', color: 'gray', sortOrder: 0, isInitial: true },
  { code: 'assigned', label: 'Assigned', color: 'blue', sortOrder: 1 },
  { code: 'in_progress', label: 'In Progress', color: 'amber', sortOrder: 2 },
  { code: 'on_hold', label: 'On Hold', color: 'orange', sortOrder: 3 },
  { code: 'review', label: 'Review', color: 'purple', sortOrder: 4 },
  { code: 'completed', label: 'Completed', color: 'green', sortOrder: 5, isTerminal: true },
  { code: 'cancelled', label: 'Cancelled', color: 'red', sortOrder: 6, isTerminal: true },
];

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

@Injectable()
export class TaskStatusesService {
  constructor(
    @InjectRepository(TaskStatusEntity)
    private readonly repo: Repository<TaskStatusEntity>,
  ) {}

  async listForFirm(firmId: string): Promise<TaskStatusEntity[]> {
    let rows = await this.repo.find({ where: { firmId }, order: { sortOrder: 'ASC' } });
    if (rows.length === 0) {
      // Seed defaults
      const seeded = DEFAULT_STATUSES.map((d) =>
        this.repo.create({
          firmId,
          code: d.code,
          label: d.label,
          color: d.color,
          sortOrder: d.sortOrder,
          isInitial: !!d.isInitial,
          isTerminal: !!d.isTerminal,
          isSystem: true,
        }),
      );
      rows = await this.repo.save(seeded);
    }
    return rows;
  }

  async create(firmId: string, dto: CreateTaskStatusDto, actorUserId: string): Promise<TaskStatusEntity> {
    const code = slugify(dto.code);
    if (!code) throw new BadRequestException('Invalid code');
    const exists = await this.repo.findOne({ where: { firmId, code } });
    if (exists) throw new BadRequestException('Status code already exists');
    const max = await this.repo
      .createQueryBuilder('s')
      .where('s.firm_id = :firmId', { firmId })
      .select('MAX(s.sort_order)', 'm')
      .getRawOne<{ m: number | null }>();
    const next = (max?.m ?? -1) + 1;
    return this.repo.save(
      this.repo.create({
        firmId,
        code,
        label: dto.label,
        color: dto.color ?? null,
        sortOrder: dto.sortOrder ?? next,
        isInitial: !!dto.isInitial,
        isTerminal: !!dto.isTerminal,
        isSystem: false,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );
  }

  async update(firmId: string, id: string, dto: UpdateTaskStatusEntityDto, actorUserId: string): Promise<TaskStatusEntity> {
    const row = await this.repo.findOne({ where: { firmId, id } });
    if (!row) throw new NotFoundException('Status not found');
    if (dto.label !== undefined) row.label = dto.label;
    if (dto.color !== undefined) row.color = dto.color;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isInitial !== undefined) row.isInitial = dto.isInitial;
    if (dto.isTerminal !== undefined) row.isTerminal = dto.isTerminal;
    row.updatedBy = actorUserId;
    return this.repo.save(row);
  }

  async delete(firmId: string, id: string): Promise<void> {
    const row = await this.repo.findOne({ where: { firmId, id } });
    if (!row) throw new NotFoundException('Status not found');
    if (row.isSystem) throw new BadRequestException('System statuses cannot be deleted');
    await this.repo.remove(row);
  }

  async reorder(firmId: string, dto: ReorderStatusesDto, actorUserId: string): Promise<TaskStatusEntity[]> {
    for (let i = 0; i < dto.ids.length; i++) {
      await this.repo.update({ firmId, id: dto.ids[i] }, { sortOrder: i, updatedBy: actorUserId });
    }
    return this.listForFirm(firmId);
  }

  async findByCode(firmId: string, code: string): Promise<TaskStatusEntity | null> {
    return this.repo.findOne({ where: { firmId, code } });
  }
}
