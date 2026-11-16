import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ClaimChallengeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  challengeId: string;
}
