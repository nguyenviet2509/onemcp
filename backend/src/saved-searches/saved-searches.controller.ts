import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { SaveSearchDto } from './dto/save-search.dto';
import { SavedSearchesService } from './saved-searches.service';

// Saved searches — user-scoped CRUD + run.
// All endpoints require authenticated user (req.user populated by TrustUserMiddleware).
@Controller('saved-searches')
export class SavedSearchesController {
  constructor(private readonly svc: SavedSearchesService) {}

  // POST /api/saved-searches — create a saved search for current user.
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@CurrentUser() user: RequestUser | undefined, @Body() dto: SaveSearchDto) {
    if (!user) throw new UnauthorizedException();
    return this.svc.create(user, dto);
  }

  // GET /api/saved-searches — list current user's saved searches.
  @Get()
  list(@CurrentUser() user: RequestUser | undefined) {
    if (!user) throw new UnauthorizedException();
    return this.svc.list(user);
  }

  // DELETE /api/saved-searches/:id — only owner can delete.
  @Delete(':id')
  remove(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string) {
    if (!user) throw new UnauthorizedException();
    return this.svc.delete(user, id);
  }

  // GET /api/saved-searches/:id/run — execute stored query via SearchService.
  @Get(':id/run')
  run(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string) {
    if (!user) throw new UnauthorizedException();
    return this.svc.run(user, id);
  }
}
