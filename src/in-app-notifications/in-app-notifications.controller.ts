import { Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentAdmin } from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { InAppNotificationsService } from './in-app-notifications.service';

@Controller('admin/notifications')
export class InAppNotificationsController {
  constructor(private readonly notifications: InAppNotificationsService) {}
  @Get() list(@CurrentAdmin() admin: AdminPrincipal) {
    return this.notifications.list(admin);
  }
  @Post(':id/read') read(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.notifications.markRead(id, admin);
  }
}
