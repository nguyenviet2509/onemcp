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

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9._/-]+$/, { message: 'branch must contain only letters, digits, . _ / -' })
  branch?: string;
}
