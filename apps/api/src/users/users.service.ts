import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });

    const saved = await this.userRepository.save(user);
    return this.toResponse(saved);
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
    };
  }
}
