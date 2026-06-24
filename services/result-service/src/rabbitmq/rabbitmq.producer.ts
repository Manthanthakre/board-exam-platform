import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface ResultViewedPayload {
  studentId: string;
  email: string;
  studentName: string;
  resultData: unknown;
  timestamp: string;
}

const EXCHANGE = 'results.exchange';
const ROUTING_KEY = 'result.viewed';
const DLX_EXCHANGE = 'results.dlx';

@Injectable()
export class RabbitMQProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQProducer.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string;

  constructor(private readonly configService: ConfigService) {
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

      // Dead-letter exchange
      await this.channel.assertExchange(DLX_EXCHANGE, 'direct', { durable: true });
      await this.channel.assertQueue('results.dlq', { durable: true });
      await this.channel.bindQueue('results.dlq', DLX_EXCHANGE, ROUTING_KEY);

      // Main exchange
      await this.channel.assertExchange(EXCHANGE, 'direct', { durable: true });
      await this.channel.assertQueue('result.viewed.queue', {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': DLX_EXCHANGE,
          'x-dead-letter-routing-key': ROUTING_KEY,
        },
      });
      await this.channel.bindQueue('result.viewed.queue', EXCHANGE, ROUTING_KEY);

      this.logger.log('RabbitMQ producer connected');

      this.connection.on('error', (err: Error) => {
        this.logger.error('RabbitMQ connection error', err.message);
      });
      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed, reconnecting...');
        setTimeout(() => void this.connect(), 5000);
      });
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ, retrying in 5s', error);
      setTimeout(() => void this.connect(), 5000);
    }
  }

  async publishResultViewed(payload: ResultViewedPayload): Promise<void> {
    if (!this.channel) {
      this.logger.warn('Channel not ready, skipping publish');
      return;
    }
    try {
      const message = Buffer.from(JSON.stringify(payload));
      this.channel.publish(EXCHANGE, ROUTING_KEY, message, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
      });
      this.logger.log(`Published result.viewed event for student ${payload.studentId}`);
    } catch (error) {
      this.logger.error('Failed to publish message', error);
      throw error;
    }
  }
}
