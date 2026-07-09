import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  sendMessage(
    @CurrentUser('userId') senderId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      senderId,
      dto.receiverId,
      dto.content,
      dto.roomId,
      dto.bookingId,
    );
  }

  @Get('conversations')
  getConversations(@CurrentUser('userId') userId: string) {
    return this.chatService.getConversations(userId);
  }

  @Post('conversations')
  createOrGetConversation(
    @CurrentUser('userId') userId: string,
    @Body('participantId') participantId: string,
  ) {
    return this.chatService.createOrGetConversation(userId, participantId);
  }

  @Get('conversation/:userId')
  getConversation(
    @Param('userId') userId: string,
    @CurrentUser('userId') currentUser: string,
  ) {
    return this.chatService.getConversation(currentUser, userId);
  }

  @Patch('read/:senderId')
  markAsRead(
    @Param('senderId') senderId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.markAsRead(userId, senderId);
  }

  // Frontend uses POST /chat/mark-read/:participantId
  @Post('mark-read/:participantId')
  markReadByParticipant(
    @Param('participantId') participantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.markAsRead(userId, participantId);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser('userId') userId: string) {
    return this.chatService.getUnreadCount(userId);
  }
}
