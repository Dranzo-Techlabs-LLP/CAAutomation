import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsISO8601, IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  scopes!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
