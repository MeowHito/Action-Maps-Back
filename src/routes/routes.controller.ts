import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';

const MAX_GPX_MB = parseInt(process.env.MAX_GPX_SIZE_MB ?? '10', 10);

@Controller()
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get('events/:slug/routes')
  list(@Param('slug') slug: string) {
    return this.routes.listByEvent(slug);
  }

  @Post('events/:slug/routes')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_GPX_MB * 1024 * 1024 },
    }),
  )
  create(
    @Param('slug') slug: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateRouteDto,
  ) {
    return this.routes.createFromUpload(slug, file, dto);
  }

  @Delete('routes/:id')
  remove(@Param('id') id: string) {
    return this.routes.remove(id);
  }
}
