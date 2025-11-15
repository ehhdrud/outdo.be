import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User, UserPayload } from '../common/decorators/user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('activities')
  async getActivities(
    @User() user: UserPayload,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.dashboardService.getActivities(user.user_pk, startDate, endDate);
  }

  @Get('achievements')
  async getAchievements(@User() user: UserPayload) {
    return this.dashboardService.getAchievements(user.user_pk);
  }
}

