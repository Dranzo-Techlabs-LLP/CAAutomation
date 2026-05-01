import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { EnquiryResponseDto } from './dto/enquiry-response.dto';
import { UpdateEnquiryStatusDto } from './dto/update-enquiry-status.dto';
import { EnquiriesService } from './enquiries.service';

@ApiTags('Enquiries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('enquiries')
export class EnquiriesController {
  constructor(private readonly enquiriesService: EnquiriesService) {}

  @Get()
  @Permissions('enquiry.view')
  async list(@CurrentUser() user: RequestUser): Promise<EnquiryResponseDto[]> {
    return this.enquiriesService.list(user.firmId);
  }

  @Post()
  @Permissions('enquiry.create')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateEnquiryDto): Promise<EnquiryResponseDto> {
    return this.enquiriesService.create(user.firmId, dto, user.id);
  }

  @Patch(':id/status')
  @Permissions('enquiry.edit')
  async updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateEnquiryStatusDto,
  ): Promise<EnquiryResponseDto> {
    return this.enquiriesService.updateStatus(user.firmId, id, dto, user.id);
  }
}
