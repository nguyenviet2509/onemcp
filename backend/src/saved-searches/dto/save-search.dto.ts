import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// DTO for POST /api/saved-searches — validated via class-validator pipe.
export class SaveSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  query!: string;

  @IsOptional()
  @IsObject()
  filters?: {
    spaceId?: string;
    templateKey?: string;
    tags?: string[];
    dept?: string;
  };

  @IsOptional()
  @IsString()
  @IsIn(['hybrid', 'fts', 'semantic'])
  mode?: string;
}
