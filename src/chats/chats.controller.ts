import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';

import { CurrentAdmin, Permissions } from '../common/decorators/decorators';
import { AdminPrincipal } from '../common/interfaces/admin-principal.interface';
import { ChatsService } from './chats.service';
import {
  AddChatNoteDto,
  AssignChatDto,
  ChatStatusDto,
  ListChatsDto,
  ListMessagesDto,
  SendMessageDto,
  SendTemplateDto,
} from './dto/chats.dto';

@Controller('admin/chats')
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Get('templates/available') @Permissions('chats.read') templates() {
    return this.chats.templates();
  }
  @Get() @Permissions('chats.read') list(
    @Query() query: ListChatsDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.chats.list(query, admin);
  }
  @Get(':id') @Permissions('chats.read') detail(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.chats.detail(id, admin);
  }
  @Get(':id/messages') @Permissions('chats.read') messages(
    @Param('id') id: string,
    @Query() query: ListMessagesDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.chats.history(id, query, admin);
  }
  @Get(':id/messages/:messageId/attachment')
  @Permissions('chats.read')
  async attachment(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @CurrentAdmin() admin: AdminPrincipal,
    @Res() response: Response,
  ) {
    const media = await this.chats.attachment(id, messageId, admin);
    response.setHeader('Content-Type', media.mimeType);
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="whatsapp-attachment"',
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(media.data);
  }
  @Post(':id/messages') @Permissions('chats.reply') send(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.chats.sendText(id, dto, admin);
  }
  @Post(':id/send-template') @Permissions('chats.templates.send') sendTemplate(
    @Param('id') id: string,
    @Body() dto: SendTemplateDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.chats.sendTemplate(id, dto, admin);
  }
  @Get(':id/quotes') @Permissions('chats.read') quotes(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.chats.quotes(id, admin);
  }
  @Get(':id/notes') @Permissions('chats.read') notes(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.chats.notes(id, admin);
  }
  @Post(':id/notes') @Permissions('chats.notes.create') addNote(
    @Param('id') id: string,
    @Body() dto: AddChatNoteDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.chats.addNote(id, dto.text, admin);
  }
  @Patch(':id/assign') @Permissions('chats.assign') assign(
    @Param('id') id: string,
    @Body() dto: AssignChatDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.chats.assign(id, dto.assignedTo, admin);
  }
  @Patch(':id/status') @Permissions('chats.manage') status(
    @Param('id') id: string,
    @Body() dto: ChatStatusDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.chats.setStatus(id, dto.status, admin);
  }
  @Post(':id/read') @Permissions('chats.read') read(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPrincipal,
  ) {
    return this.chats.markRead(id, admin);
  }
}
