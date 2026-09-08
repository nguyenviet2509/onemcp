import { IsIn, IsISO8601, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { KNOWN_MCP_TOOLS } from '../mcp/mcp-args-redactor';

// F2 red-team fix: strict input validation. Without this, raw @Query() params
// let attackers craft invalid dates that TypeORM silently coerces to NULL, or
// enumerate arbitrary usernames via the actor filter.
//
// Applied via global ValidationPipe (main.ts) with:
//   whitelist: true (strip unknown fields)
//   forbidNonWhitelisted: true (400 if unknown field sent)
//   transform: true (coerce query string types)
export class ListMcpCallsDto {
  @IsOptional()
  @Matches(/^[a-zA-Z0-9._@-]{1,64}$/, {
    message: 'user must be alphanumeric + . _ @ -, max 64 chars',
  })
  user?: string;

  @IsOptional()
  @IsIn([...KNOWN_MCP_TOOLS], {
    message: `tool must be one of: ${KNOWN_MCP_TOOLS.join(', ')}`,
  })
  tool?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['ok', 'error'])
  status?: 'ok' | 'error';

  // 1-based page number. Client sends 1, 2, 3, ...
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  pageSize?: number;
}
