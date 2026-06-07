import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SaveCustomerSelectedLocationDto } from './locations.dto';
import { LocationsService } from './locations.service';

@Controller()
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post('customer/locations/selected')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  saveSelectedLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SaveCustomerSelectedLocationDto,
  ) {
    return this.locations.saveCustomerSelectedLocation(user.id, body);
  }
}
