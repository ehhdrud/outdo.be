import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoutinesService } from './routines.service';
import {
  CreateRoutineDto,
  SaveRoutineDayDto,
  SaveRoutineDayWithDateDto,
  UpdateRoutineNameDto,
} from './dto/create-routine.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User, UserPayload } from '../common/decorators/user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Post()
  async createRoutine(@User() user: UserPayload, @Body() dto: CreateRoutineDto) {
    return this.routinesService.createRoutine(user.user_pk, dto);
  }

  @Get()
  async getRoutines(@User() user: UserPayload) {
    return this.routinesService.getRoutinesWithLatestInfo(user.user_pk);
  }

  @Get(':routine_pk/today')
  async getTodayRoutine(
    @User() user: UserPayload,
    @Param('routine_pk', ParseIntPipe) routinePk: number,
  ) {
    return this.routinesService.getTodayRoutine(user.user_pk, routinePk);
  }

  @Get('by-date')
  async getRoutineByDate(
    @User() user: UserPayload,
    @Query('routine_pk', ParseIntPipe) routinePk: number,
    @Query('date') date: string,
  ) {
    return this.routinesService.getRoutineByDate(user.user_pk, routinePk, date);
  }

  @Post(':routine_pk/days/today')
  async saveTodayRoutine(
    @User() user: UserPayload,
    @Param('routine_pk', ParseIntPipe) routinePk: number,
    @Body() dto: SaveRoutineDayDto,
  ) {
    return this.routinesService.saveTodayRoutine(user.user_pk, routinePk, dto);
  }

  @Post(':routine_pk/days')
  async saveRoutineDay(
    @User() user: UserPayload,
    @Param('routine_pk', ParseIntPipe) routinePk: number,
    @Body() dto: SaveRoutineDayWithDateDto,
  ) {
    return this.routinesService.saveRoutineDay(user.user_pk, routinePk, dto);
  }

  @Patch(':routine_pk')
  async updateRoutineName(
    @User() user: UserPayload,
    @Param('routine_pk', ParseIntPipe) routinePk: number,
    @Body() dto: UpdateRoutineNameDto,
  ) {
    return this.routinesService.updateRoutineName(user.user_pk, routinePk, dto);
  }

  @Delete(':routine_pk')
  async deleteRoutine(
    @User() user: UserPayload,
    @Param('routine_pk', ParseIntPipe) routinePk: number,
  ) {
    return this.routinesService.deleteRoutine(user.user_pk, routinePk);
  }
}

