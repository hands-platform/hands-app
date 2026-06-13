import type { AdminServiceCatalogItem } from '../../lib/admin-api';
import { updateService } from './actions';

type ServiceOptionEditFormProps = {
  readonly service: AdminServiceCatalogItem;
};

export function ServiceOptionEditForm({ service }: ServiceOptionEditFormProps) {
  return (
    <form action={updateService} className="form-grid compact-form">
      <input type="hidden" name="serviceId" value={service.id} />
      <label>
        Group key
        <input name="serviceGroupKey" defaultValue={service.serviceGroupKey ?? ''} />
      </label>
      <label>
        Name
        <input name="name" defaultValue={service.name} />
      </label>
      <label>
        Duration
        <input name="durationMin" type="number" min="1" defaultValue={service.durationMin} />
      </label>
      <label>
        Minimum price
        <input
          name="basePrice"
          type="number"
          min="100000"
          step={service.priceStep}
          defaultValue={service.basePrice}
        />
      </label>
      <label>
        Price step
        <input name="priceStep" type="number" min="100000" step="100000" defaultValue={service.priceStep} />
      </label>
      <label>
        Display order
        <input name="displayOrder" type="number" defaultValue={service.displayOrder} />
      </label>
      <label className="full-span">
        Description
        <input name="description" defaultValue={service.description ?? ''} />
      </label>
      <label>
        Active
        <input name="active" type="checkbox" defaultChecked={service.active} />
      </label>
      <button type="submit">Update service</button>
    </form>
  );
}
