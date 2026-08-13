import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

// P6+: partial update for owner/admin.
// Slug immutable (used as external identifier + FS mirror key).
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, { message: 'gitRepoUrl must be http(s) URL' })
  gitRepoUrl?: string;

  @IsOptional()
  @IsIn(['public', 'dept', 'private'])
  scope?: 'public' | 'dept' | 'private';
}
