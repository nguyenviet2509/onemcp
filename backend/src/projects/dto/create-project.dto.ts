import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

// P6: project self-registration payload.
export class CreateProjectDto {
  @IsString()
  @Length(2, 64)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be kebab-case ([a-z0-9-])' })
  slug!: string;

  @IsString()
  @Length(2, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsString()
  @Matches(/^https?:\/\/.+/, { message: 'gitRepoUrl must be http(s) URL' })
  gitRepoUrl!: string;

  @IsOptional()
  @IsIn(['public', 'dept', 'private'])
  scope?: 'public' | 'dept' | 'private';

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9._/-]+$/, { message: 'branch must contain only letters, digits, . _ / -' })
  branch?: string;
}
