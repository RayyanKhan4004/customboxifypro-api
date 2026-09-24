import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { CustomerRequest } from '../customer-requests/schemas/customer-request.schema';
import { Customer } from '../chats/schemas/customer.schema';
import { Conversation } from '../chats/schemas/conversation.schema';
import { ChatMessage } from '../chats/schemas/message.schema';
import { MessageStatusEvent } from '../chats/schemas/message-status.schema';
import { NotificationOutbox } from '../jobs/notifications/notification-outbox.schema';
import { InAppNotification } from '../in-app-notifications/in-app-notification.schema';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    for (const name of [
      CustomerRequest.name,
      Customer.name,
      Conversation.name,
      ChatMessage.name,
      MessageStatusEvent.name,
      NotificationOutbox.name,
      InAppNotification.name,
    ]) {
      const model = app.get<Model<unknown>>(getModelToken(name));
      await model.createIndexes();
      process.stdout.write(`${name} indexes verified\n`);
    }
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Index setup failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = 1;
});
