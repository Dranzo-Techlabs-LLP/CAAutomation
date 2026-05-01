import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TeamResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firmId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiPropertyOptional()
  leadUserId?: string | null;

  @ApiPropertyOptional()
  lastAssignedUserId?: string | null;

  @ApiProperty()
  isActive!: boolean;
}
