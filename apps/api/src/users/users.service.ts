import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email: email.toLowerCase() } });
  }

  async findActiveById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id, isActive: true } });
  }

  async getByIdForFirm(id: string, firmId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id, firmId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toResponse(user);
  }

  async listForFirm(firmId: string): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      where: { firmId },
      order: { name: 'ASC' },
    });
    return users.map((user) => this.toResponse(user));
  }

  async createForFirm(firmId: string, dto: CreateUserDto, actorUserId: string): Promise<UserResponseDto> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const rounds = Number(this.config.get<string>('BCRYPT_ROUNDS') ?? 12);
    const user = this.userRepository.create({
      firmId,
      name: dto.name,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      roleId: dto.roleId,
      passwordHash: await bcrypt.hash(dto.password, rounds),
      defaultHourlyRate: dto.defaultHourlyRate ?? null,
      costRate: dto.costRate ?? null,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });

    const saved = await this.userRepository.save(user);
    return this.toResponse(saved);
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }
    const rounds = Number(this.config.get<string>('BCRYPT_ROUNDS') ?? 12);
    const passwordHash = await bcrypt.hash(newPassword, rounds);
    await this.userRepository.update({ id: userId }, { passwordHash });
  }

  async resetPassword(userId: string, firmId: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId, firmId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const rounds = Number(this.config.get<string>('BCRYPT_ROUNDS') ?? 12);
    const passwordHash = await bcrypt.hash(newPassword, rounds);
    await this.userRepository.update({ id: userId }, { passwordHash });
  }

  async updateUser(
    userId: string,
    firmId: string,
    body: { name?: string; email?: string; phone?: string | null; roleId?: string; isActive?: boolean },
    actorUserId: string,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId, firmId } });
    if (!user) throw new NotFoundException('User not found');
    if (body.name !== undefined) user.name = body.name;
    if (body.email !== undefined) {
      const next = body.email.toLowerCase();
      if (next !== user.email) {
        const dup = await this.userRepository.findOne({ where: { email: next } });
        if (dup && dup.id !== user.id) throw new ConflictException('Email already in use');
        user.email = next;
      }
    }
    if (body.phone !== undefined) user.phone = body.phone || null;
    if (body.roleId !== undefined) user.roleId = body.roleId;
    if (body.isActive !== undefined) user.isActive = body.isActive;
    user.updatedBy = actorUserId;
    return this.toResponse(await this.userRepository.save(user));
  }

  /**
   * "Delete" a user = deactivate (soft). Hard deletion is unsafe — users are
   * referenced by tasks, time logs and audit rows. Deactivating revokes access
   * and removes them from assignee pickers while preserving history. Blocks
   * self-deactivation.
   */
  async deactivate(userId: string, firmId: string, actorUserId: string): Promise<UserResponseDto> {
    if (userId === actorUserId) throw new BadRequestException('You cannot deactivate your own account.');
    const user = await this.userRepository.findOne({ where: { id: userId, firmId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    user.updatedBy = actorUserId;
    return this.toResponse(await this.userRepository.save(user));
  }

  async updateRates(
    userId: string,
    firmId: string,
    body: { defaultHourlyRate?: string | null; costRate?: string | null },
    actorUserId: string,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId, firmId } });
    if (!user) throw new NotFoundException('User not found');
    if (body.defaultHourlyRate !== undefined) user.defaultHourlyRate = body.defaultHourlyRate || null;
    if (body.costRate !== undefined) user.costRate = body.costRate || null;
    user.updatedBy = actorUserId;
    return this.toResponse(await this.userRepository.save(user));
  }

  async markLogin(userId: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { lastLoginAt: new Date() });
  }

  toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      firmId: user.firmId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      isActive: user.isActive,
      defaultHourlyRate: user.defaultHourlyRate ?? null,
      costRate: user.costRate ?? null,
    };
  }
}
