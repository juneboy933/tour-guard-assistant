import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class AgentChatDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(2000)
  message!: string;
}
