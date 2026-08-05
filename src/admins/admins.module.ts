import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RolesModule } from '../roles/roles.module';
import { NotificationsModule } from '../jobs/notifications/notifications.module';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';
import { AdminRepository } from './repositories/admin.repository';
import { Admin, AdminSchema } from './schemas/admin.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),
    RolesModule,
    AuditLogsModule,
    NotificationsModule,
  ],
  controllers: [AdminsController],
  providers: [AdminsService, AdminRepository],
  exports: [AdminsService, AdminRepository],
})
export class AdminsModule {}
