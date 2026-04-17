import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PhotosService } from './photos.service';
import { CreatePhotoDto } from './dto/create-photo.dto';

const MAX_PHOTO_MB = parseInt(process.env.MAX_PHOTO_SIZE_MB ?? '12', 10);

@Controller()
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get('events/:slug/photos')
  list(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.photos.listByEvent(
      slug,
      limit ? parseInt(limit, 10) : 500,
      skip ? parseInt(skip, 10) : 0,
    );
  }

  @Post('events/:slug/photos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_MB * 1024 * 1024 },
    }),
  )
  create(
    @Param('slug') slug: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePhotoDto,
  ) {
    return this.photos.createFromUpload(slug, file, dto);
  }

  @Delete('photos/:id')
  remove(@Param('id') id: string) {
    return this.photos.remove(id);
  }
}
