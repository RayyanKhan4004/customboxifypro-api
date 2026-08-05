import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin, Permissions } from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { Permissions as PermissionList } from '../roles/permissions';
import { BulkImportService } from './bulk-import.service';
import {
  CreateBulkImportDto,
  ListBulkImportQueryDto,
} from './dto/bulk-import.dto';

@ApiTags('admin-bulk-imports')
@ApiBearerAuth()
@Controller('admin/bulk-imports')
export class BulkImportController {
  constructor(private readonly service: BulkImportService) {}

  @Get('template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="products-import-template.csv"',
  )
  @Permissions(PermissionList.PRODUCTS_BULK_IMPORT)
  template() {
    return this.service.template();
  }

  @Get()
  @Permissions(PermissionList.PRODUCTS_BULK_IMPORT)
  list(@Query() query: ListBulkImportQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @Permissions(PermissionList.PRODUCTS_BULK_IMPORT)
  create(
    @Body() dto: CreateBulkImportDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.service.create(dto, file, admin);
  }

  @Post('validate')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @Permissions(PermissionList.PRODUCTS_BULK_IMPORT)
  validate(@UploadedFile() file: Express.Multer.File) {
    return this.service.validate(file);
  }

  @Get(':id')
  @Permissions(PermissionList.PRODUCTS_BULK_IMPORT)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/errors')
  @Permissions(PermissionList.PRODUCTS_BULK_IMPORT)
  errors(@Param('id') id: string) {
    return this.service.errors(id);
  }

  @Get(':id/error-file')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="import-errors.csv"')
  @Permissions(PermissionList.PRODUCTS_BULK_IMPORT)
  errorFile(@Param('id') id: string) {
    return this.service.errorFile(id);
  }

  @Post(':id/retry')
  @Permissions(PermissionList.PRODUCTS_BULK_IMPORT)
  retry(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    return this.service.retry(id, admin);
  }

  @Post(':id/cancel')
  @Permissions(PermissionList.PRODUCTS_BULK_IMPORT)
  cancel(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    return this.service.cancel(id, admin);
  }
}
