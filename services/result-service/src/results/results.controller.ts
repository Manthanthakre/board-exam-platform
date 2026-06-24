import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Version,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ResultsService } from './results.service';
import { CreateResultDto, UpdateResultDto } from './dto/result.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Result } from './entities/result.entity';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('Results')
@ApiBearerAuth()
@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Version('1')
  @Post()
  @UseGuards(RolesGuard)
  @Roles('MODERATOR')
  @ApiOperation({ summary: 'Create a result (Moderator only)' })
  create(@Body() dto: CreateResultDto): Promise<Result> {
    return this.resultsService.create(dto);
  }

  @Version('1')
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('MODERATOR')
  @ApiOperation({ summary: 'Update a result (Moderator only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResultDto,
  ): Promise<Result> {
    return this.resultsService.update(id, dto);
  }

  @Version('1')
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('MODERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a result (Moderator only)' })
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.resultsService.delete(id);
  }

  @Version('1')
  @Get()
  @UseGuards(RolesGuard)
  @Roles('MODERATOR')
  @ApiOperation({ summary: 'Get all results (Moderator only)' })
  findAll(): Promise<Result[]> {
    return this.resultsService.findAll();
  }

  @Version('1')
  @Get('me')
  @ApiOperation({ summary: 'Get own results (Student)' })
  findOwn(@CurrentUser() user: AuthUser): Promise<Result[]> {
    return this.resultsService.findOwnResults(user);
  }

  @Version('1')
  @Get(':studentId')
  @ApiOperation({ summary: 'Get results by studentId' })
  findByStudent(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Result[]> {
    return this.resultsService.findByStudentId(studentId, user);
  }
}
