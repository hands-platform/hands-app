import { NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service';

describe('LocationsService customer ownership', () => {
  it('deletes only a location owned by the signed-in customer', async () => {
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerSelectedLocation: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new LocationsService(prisma as never);

    await expect(
      service.deleteCustomerLocation('user-1', 'another-customer-location'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customerSelectedLocation.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'another-customer-location',
        customerProfileId: 'customer-1',
      },
    });
  });
});
