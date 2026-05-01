import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { AttachmentEntityType, AttachmentTag } from '../attachment.entity';

export class CreateAttachmentDto {
  @ApiProperty({ enum: AttachmentEntityType })
  @IsEnum(AttachmentEntityType)
  entityType!: AttachmentEntityType;

  @ApiProperty()
  @IsString()
  entityId!: string;

  @ApiProperty()
  @IsString()
  fileName!: string;

  @ApiProperty()
  @IsString()
  fileUrl!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsString()
  sizeBytes!: string;

  @ApiPropertyOptional({ enum: AttachmentTag })
  @IsEnum(AttachmentTag)
  tag!: AttachmentTag;
}
