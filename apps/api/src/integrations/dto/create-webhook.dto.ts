import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsUrl } from 'class-validator';

export class CreateWebhookDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  events!: string[];
}
