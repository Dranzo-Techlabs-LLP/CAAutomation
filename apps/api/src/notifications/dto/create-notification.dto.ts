import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty()
  payloadJson!: Record<string, unknown>;
}
