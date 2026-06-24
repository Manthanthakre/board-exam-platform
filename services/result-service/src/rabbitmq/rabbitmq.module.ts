import { Module } from '@nestjs/common';
import { RabbitMQProducer } from './rabbitmq.producer';

@Module({
  providers: [RabbitMQProducer],
  exports: [RabbitMQProducer],
})
export class RabbitMQModule {}
