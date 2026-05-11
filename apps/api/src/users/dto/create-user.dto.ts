import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNumberString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  password!: string;

  @ApiProperty()
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({ description: 'Default billing rate paise/hour for time logs' })
  @IsOptional()
  @IsNumberString()
  defaultHourlyRate?: string;

  @ApiPropertyOptional({ description: 'Internal cost rate paise/hour (for margin)' })
  @IsOptional()
  @IsNumberString()
  costRate?: string;
}
