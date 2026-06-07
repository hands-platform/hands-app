import { IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';

export class SaveCustomerSelectedLocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  addressText!: string;
}
