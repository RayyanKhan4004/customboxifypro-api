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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

import {
  CurrentAdmin,
  Permissions,
  Public,
} from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApiException } from '../common/exceptions/api.exception';
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

  @Post('with-attachment')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('attachment', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async submitWithAttachment(
    @Body('payload') payload: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { ip?: string },
  ) {
    if (!file) {
      throw ApiException.invalid(
        ErrorCodes.MEDIA_UPLOAD_INVALID,
        'An attachment file is required.',
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw ApiException.invalid(
        ErrorCodes.MEDIA_UPLOAD_INVALID,
        'The request payload must be valid JSON.',
      );
    }
    const dto = plainToInstance(SubmitCustomerRequestDto, parsed);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw ApiException.invalid(
        ErrorCodes.MEDIA_UPLOAD_INVALID,
        'The request payload is invalid.',
      );
    }
    return this.service.submitWithAttachment(dto, file, req.ip);
  }
}
