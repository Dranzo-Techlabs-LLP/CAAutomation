import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateTaskStatusDto {
  @ApiProperty({ description: 'Status code (custom statuses supported)' })
  @IsString()
  @MaxLength(60)
  status!: string;
}
