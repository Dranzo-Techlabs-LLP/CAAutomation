import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionResponseDto } from './dto/permission-response.dto';
import { Permission } from './permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async list(): Promise<PermissionResponseDto[]> {
    const permissions = await this.permissionRepository.find({ order: { module: 'ASC', code: 'ASC' } });
    return permissions.map((permission) => this.toResponse(permission));
  }

  toResponse(permission: Permission): PermissionResponseDto {
    return {
      id: permission.id,
      code: permission.code,
      description: permission.description,
      module: permission.module,
    };
  }
}
