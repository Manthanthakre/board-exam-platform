import {
  Controller,
  Get,
  Param,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { EmailLogDocument } from './schemas/email-log.schema';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Notifications')
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Version('1')
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check' })
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Version('1')
  @Get('logs/:studentId')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('MODERATOR')
  @ApiOperation({ summary: 'Get email delivery logs for a student (Moderator only)' })
  getLogs(@Param('studentId') studentId: string): Promise<EmailLogDocument[]> {
    return this.notificationsService.getLogsByStudentId(studentId);
  }
}
