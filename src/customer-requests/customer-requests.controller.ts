import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  CurrentAdmin,
  Permissions,
  Public,
} from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { Permissions as PermissionList } from '../roles/permissions';
import { CustomerRequestsService } from './customer-requests.service';
import {
  AddNoteDto,
  AssignRequestDto,
  BulkStatusDto,
  ListRequestsQueryDto,
  SubmitCustomerRequestDto,
  UpdateRequestStatusDto,
} from './dto/customer-request.dto';

@ApiTags('admin-customer-requests')
@ApiBearerAuth()
@Controller('admin/requests')
export class AdminCustomerRequestsController {
  constructor(private readonly service: CustomerRequestsService) {}

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="requests.csv"')
  @Permissions(PermissionList.REQUESTS_READ)
  export(@Query() query: ListRequestsQueryDto) {
    return this.service.exportCsv(query);
  }

  @Get()
  @Permissions(PermissionList.REQUESTS_READ)
  list(@Query() query: ListRequestsQueryDto) {
    return this.service.list(query);
  }

  @Post('bulk-status')
  @Permissions(PermissionList.REQUESTS_UPDATE)
  bulkStatus(
    @Body() dto: BulkStatusDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.service.bulkStatus(dto, admin);
  }

  @Get(':id')
  @Permissions(PermissionList.REQUESTS_READ)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  @Permissions(PermissionList.REQUESTS_UPDATE)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.service.updateStatus(id, dto, admin);
  }

  @Post(':id/assign')
  @Permissions(PermissionList.REQUESTS_ASSIGN)
  assign(
    @Param('id') id: string,
    @Body() dto: AssignRequestDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.service.assign(id, dto, admin);
  }

  @Post(':id/notes')
  @Permissions(PermissionList.REQUESTS_UPDATE)
  addNote(
    @Param('id') id: string,
    @Body() dto: AddNoteDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.service.addNote(id, dto, admin);
  }
}

@ApiTags('public-customer-requests')
@Controller('requests')
export class PublicCustomerRequestsController {
  constructor(private readonly service: CustomerRequestsService) {}

  @Post()
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  submit(@Body() dto: SubmitCustomerRequestDto, @Req() req: { ip?: string }) {
    return this.service.submit(dto, req.ip);
  }
}
