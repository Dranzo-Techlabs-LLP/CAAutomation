import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from '../permissions/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { RolePermission } from './role-permission.entity';
import { Role } from './role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  async getPermissionCodes(roleId: string): Promise<string[]> {
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId },
      relations: { permission: true },
    });

    return rolePermissions.map((rolePermission) => rolePermission.permission.code);
  }

  async listForFirm(firmId: string): Promise<RoleResponseDto[]> {
    const roles = await this.roleRepository.find({
      where: { firmId },
      order: { name: 'ASC' },
    });

    return Promise.all(roles.map((role) => this.toResponse(role)));
  }

  async create(firmId: string, dto: CreateRoleDto, actorUserId: string): Promise<RoleResponseDto> {
    const existing = await this.roleRepository.findOne({ where: { firmId, name: dto.name } });
    if (existing) {
      throw new ConflictException('Role name already exists for this firm');
    }

    const role = await this.roleRepository.save(
      this.roleRepository.create({
        firmId,
        name: dto.name,
        isSystemRole: dto.isSystemRole ?? false,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );

    if (dto.permissionIds?.length) {
      await this.replacePermissions(role.id, dto.permissionIds, actorUserId);
    }

    return this.toResponse(role);
  }

  async setPermissions(
    firmId: string,
    roleId: string,
    permissionIds: string[],
    actorUserId: string,
  ): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findOne({ where: { id: roleId, firmId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.replacePermissions(roleId, permissionIds, actorUserId);
    return this.toResponse(role);
  }

  private async replacePermissions(
    roleId: string,
    permissionIds: string[],
    actorUserId: string,
  ): Promise<void> {
    const uniquePermissionIds = [...new Set(permissionIds)];
    const permissionCount = await this.permissionRepository.countBy({ id: In(uniquePermissionIds) });

    if (permissionCount !== uniquePermissionIds.length) {
      throw new NotFoundException('One or more permissions were not found');
    }

    await this.rolePermissionRepository.delete({ roleId });
    await this.rolePermissionRepository.save(
      uniquePermissionIds.map((permissionId) =>
        this.rolePermissionRepository.create({
          roleId,
          permissionId,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        }),
      ),
    );
  }

  private async toResponse(role: Role): Promise<RoleResponseDto> {
    return {
      id: role.id,
      firmId: role.firmId,
      name: role.name,
      isSystemRole: role.isSystemRole,
      permissionCodes: await this.getPermissionCodes(role.id),
    };
  }
}
