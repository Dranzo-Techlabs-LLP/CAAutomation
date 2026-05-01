import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firmId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isSystemRole!: boolean;

  @ApiProperty({ type: [String] })
  permissionCodes!: string[];
}
