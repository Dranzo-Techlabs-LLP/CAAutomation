import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firmId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiProperty()
  roleId!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional()
  defaultHourlyRate?: string | null;

  @ApiPropertyOptional()
  costRate?: string | null;
}
