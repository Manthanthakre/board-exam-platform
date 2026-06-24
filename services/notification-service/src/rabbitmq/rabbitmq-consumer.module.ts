import { Module } from '@nestjs/common';
import { RabbitMQConsumer } from './rabbitmq.consumer';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [RabbitMQConsumer],
})
export class RabbitMQConsumerModule {}
