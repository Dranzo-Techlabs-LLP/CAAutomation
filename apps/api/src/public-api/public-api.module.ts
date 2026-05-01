import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { EnquiriesModule } from '../enquiries/enquiries.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { RecurrencesModule } from '../recurrences/recurrences.module';
import { TasksModule } from '../tasks/tasks.module';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { PublicApiController } from './public-api.controller';

@Module({
  imports: [IntegrationsModule, TasksModule, CustomersModule, EnquiriesModule, RecurrencesModule],
  controllers: [PublicApiController],
  providers: [ApiKeyAuthGuard],
})
export class PublicApiModule {}
