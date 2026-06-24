import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { NotificationsService, ResultViewedEvent } from '../notifications/notifications.service';

const EXCHANGE = 'results.exchange';
const QUEUE = 'result.viewed.queue';
const ROUTING_KEY = 'result.viewed';
const DLX_EXCHANGE = 'results.dlx';

@Injectable()
export class RabbitMQConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQConsumer.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.url = this.configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      // Prefetch 1 so we process one message at a time (safer for retry logic)
      await this.channel.prefetch(1);

      // Dead-letter exchange + queue setup
      await this.channel.assertExchange(DLX_EXCHANGE, 'direct', { durable: true });
      await this.channel.assertQueue('results.dlq', { durable: true });
      await this.channel.bindQueue('results.dlq', DLX_EXCHANGE, ROUTING_KEY);

      // Main exchange + queue
      await this.channel.assertExchange(EXCHANGE, 'direct', { durable: true });
      await this.channel.assertQueue(QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': DLX_EXCHANGE,
          'x-dead-letter-routing-key': ROUTING_KEY,
        },
      });
      await this.channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

      this.logger.log('RabbitMQ consumer connected, waiting for messages…');

      await this.channel.consume(QUEUE, (msg) => void this.handleMessage(msg), {
        noAck: false,
      });

      this.connection.on('error', (err: Error) => {
        this.logger.error('RabbitMQ connection error', err.message);
      });
      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed, reconnecting in 5s…');
        setTimeout(() => void this.connect(), 5000);
      });
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ, retrying in 5s…', error);
      setTimeout(() => void this.connect(), 5000);
    }
  }

  private async handleMessage(msg: amqp.ConsumeMessage | null): Promise<void> {
    if (!msg || !this.channel) return;

    let event: ResultViewedEvent;
    try {
      event = JSON.parse(msg.content.toString()) as ResultViewedEvent;
    } catch {
      this.logger.error('Failed to parse message, sending to DLQ');
      this.channel.nack(msg, false, false); // send to DLQ, do not requeue
      return;
    }

    try {
      this.logger.log(`Processing result.viewed for student ${event.studentId}`);
      await this.notificationsService.handleResultViewed(event);
      this.channel.ack(msg);
    } catch (error) {
      this.logger.error(`Error handling message for ${event.studentId}`, error);
      // nack without requeue — NotificationsService already handles retries internally
      this.channel.nack(msg, false, false);
    }
  }
}
