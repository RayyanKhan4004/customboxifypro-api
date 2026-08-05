import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin, Permissions } from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { Permissions as PermissionList } from '../roles/permissions';
import { MediaService } from './media.service';
import {
  CompleteUploadDto,
  ListMediaQueryDto,
  PresignMediaDto,
  UpdateMediaDto,
} from './dto/media.dto';

@ApiTags('admin-media')
@ApiBearerAuth()
@Controller('admin/media')
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @Get()
  @Permissions(PermissionList.MEDIA_MANAGE)
  list(@Query() query: ListMediaQueryDto) {
    return this.service.list(query);
  }

  @Post('presign')
  @Permissions(PermissionList.MEDIA_MANAGE)
  presign(@Body() dto: PresignMediaDto, @CurrentAdmin() admin: AdminPrincipal) {
    return this.service.presignUpload(dto, admin);
  }

  @Post(':id/complete')
  @Permissions(PermissionList.MEDIA_MANAGE)
  complete(@Param('id') id: string, @Body() dto: CompleteUploadDto) {
    return this.service.completeUpload(id, dto);
  }

  @Patch(':id')
  @Permissions(PermissionList.MEDIA_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMediaDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.service.update(id, dto, admin);
  }

  @Delete(':id')
  @Permissions(PermissionList.MEDIA_MANAGE)
  remove(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    return this.service.remove(id, admin);
  }
}
