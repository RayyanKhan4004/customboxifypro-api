import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';

import { AuditService } from '../../audit-logs/audit.service';
import { CurrentAdmin, Permissions } from '../../common/decorators/decorators';
import { AdminPrincipal } from '../../common/interfaces/admin-principal.interface';
import { NotificationService } from './notification.service';
import { AuditActions } from '../../audit-logs/audit-actions';

class RetryDeliveryDto {
  @IsOptional() @IsBoolean() confirmPossibleDuplicate?: boolean;
}

@Controller('admin/notification-deliveries')
export class NotificationDeliveriesController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  @Get('failed') @Permissions('settings.manage') list() {
    return this.notifications.listFailed();
  }

  @Post('whatsapp-test/hello-world')
  @Permissions('settings.manage')
  async helloWorld(@CurrentAdmin() admin: AdminPrincipal) {
    await this.notifications.queueHelloWorldTest();
    await this.audit.log({
      actorId: admin.id,
      action: AuditActions.WHATSAPP_TEST_QUEUED,
      resourceType: 'whatsapp-test',
      resourceId: 'hello_world',
    });
    return { queued: true };
  }

  @Post(':id/retry')
  @Permissions('settings.manage')
  async retry(
    @Param('id') id: string,
    @Body() dto: RetryDeliveryDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    const retried = await this.notifications.retry(
      id,
      dto.confirmPossibleDuplicate === true,
    );
    if (retried)
      await this.audit.log({
        actorId: admin.id,
        action: AuditActions.NOTIFICATION_RETRY,
        resourceType: 'notification-outbox',
        resourceId: id,
      });
    return { retried };
  }
}
