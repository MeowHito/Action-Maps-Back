import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateCodesDto } from './dto/update-codes.dto';
import { SiteAdminGuard } from '../auth/guards/site-admin.guard';
import type { SiteAuthedRequest } from '../auth/guards/site-admin.guard';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @UseGuards(SiteAdminGuard)
  create(@Body() dto: CreateEventDto, @Req() req: SiteAuthedRequest) {
    return this.events.create(dto, req.siteUser.sub);
  }

  /** Public list (attendee browse) — never includes access codes. */
  @Get()
  list(@Query('limit') limit?: string, @Query('skip') skip?: string) {
    return this.events.list(
      limit ? parseInt(limit, 10) : 50,
      skip ? parseInt(skip, 10) : 0,
    );
  }

  /** Events the logged-in user may manage (super-admin: all; user: own). */
  @Get('mine')
  @UseGuards(SiteAdminGuard)
  mine(@Req() req: SiteAuthedRequest) {
    return this.events.listForUser(req.siteUser);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.events.getBySlugLean(slug);
  }

  /** View the real access codes (owner/super-admin only). */
  @Get(':slug/codes')
  @UseGuards(SiteAdminGuard)
  async getCodes(@Param('slug') slug: string, @Req() req: SiteAuthedRequest) {
    await this.events.assertCanManage(slug, req.siteUser);
    return this.events.getCodesForManage(slug);
  }

  /** Change the access codes (owner/super-admin only). */
  @Patch(':slug/codes')
  @UseGuards(SiteAdminGuard)
  async updateCodes(
    @Param('slug') slug: string,
    @Body() dto: UpdateCodesDto,
    @Req() req: SiteAuthedRequest,
  ) {
    await this.events.assertCanManage(slug, req.siteUser);
    return this.events.updateCodes(slug, dto);
  }

  @Patch(':slug')
  @UseGuards(SiteAdminGuard)
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdateEventDto,
    @Req() req: SiteAuthedRequest,
  ) {
    await this.events.assertCanManage(slug, req.siteUser);
    return this.events.update(slug, dto);
  }

  @Delete(':slug')
  @UseGuards(SiteAdminGuard)
  async remove(@Param('slug') slug: string, @Req() req: SiteAuthedRequest) {
    await this.events.assertCanManage(slug, req.siteUser);
    return this.events.remove(slug);
  }
}
