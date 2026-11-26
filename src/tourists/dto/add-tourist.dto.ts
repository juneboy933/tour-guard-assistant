import { IsNotEmpty, IsPhoneNumber, IsString, Matches } from 'class-validator';

export class addTouristDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber('KE')
  @Matches(/\S/)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  tourId: string;
}
