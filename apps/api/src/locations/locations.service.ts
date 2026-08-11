import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isVietnamServiceAreaCoordinate } from './location-update-policy';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveCustomerSelectedLocation(
    userId: string | undefined,
    input: { lat: number; lng: number; addressText: string },
  ) {
    if (!userId) {
      throw new BadRequestException('Authenticated customer is required');
    }
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
      throw new BadRequestException('lat and lng are required');
    }
    if (!isVietnamServiceAreaCoordinate(input.lat, input.lng)) {
      throw new BadRequestException('Selected location must be inside Vietnam');
    }
    if (!input.addressText?.trim()) {
      throw new BadRequestException('addressText is required');
    }

    const customerProfile = await this.requireCustomerProfile(userId);

    return this.prisma.customerSelectedLocation.create({
      data: {
        customerProfileId: customerProfile.id,
        latitude: input.lat,
        longitude: input.lng,
        addressText: input.addressText.trim(),
      },
    });
  }

  async listCustomerLocations(userId: string | undefined) {
    const customerProfile = await this.requireCustomerProfile(userId);
    return this.prisma.customerSelectedLocation.findMany({
      where: { customerProfileId: customerProfile.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async deleteCustomerLocation(
    userId: string | undefined,
    locationId: string,
  ) {
    const customerProfile = await this.requireCustomerProfile(userId);
    const deleted = await this.prisma.customerSelectedLocation.deleteMany({
      where: {
        id: locationId,
        customerProfileId: customerProfile.id,
      },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Customer location not found');
    }
    return { deleted: true };
  }

  private async requireCustomerProfile(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException('Authenticated customer is required');
    }
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customerProfile) {
      throw new NotFoundException('Customer profile not found');
    }
    return customerProfile;
  }
}
