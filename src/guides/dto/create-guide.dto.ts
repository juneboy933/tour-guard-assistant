import { IsNotEmpty, IsPhoneNumber, IsString, Matches } from 'class-validator';

export class createGuideDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/\S/)
    name: string;

    @IsString()
    @IsNotEmpty()
    @IsPhoneNumber('KE')
    @Matches(/\S/)
    phone: string;
}
