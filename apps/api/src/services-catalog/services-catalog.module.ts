import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceCatalog } from './service-catalog.entity';
import { ServiceSubtaskTemplate } from './service-subtask-template.entity';
import { ServicesCatalogController } from './services-catalog.controller';
import { ServicesCatalogService } from './services-catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceCatalog, ServiceSubtaskTemplate])],
  controllers: [ServicesCatalogController],
  providers: [ServicesCatalogService],
  exports: [ServicesCatalogService, TypeOrmModule],
})
export class ServicesCatalogModule {}
