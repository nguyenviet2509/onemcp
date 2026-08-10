import { IsOptional, IsString, Length } from 'class-validator';

export class RejectProjectDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}
