import { IsNumber } from 'class-validator';

export class UpdateProviderLocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}
