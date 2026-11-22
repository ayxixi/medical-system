import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AuthenticatedAccount,
  CurrentAccount,
} from '../auth/decorators/current-account.decorator';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileService } from './file.service';

type UploadedFilePayload = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
};

@Controller()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('files/upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentAccount() account: AuthenticatedAccount,
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Body() uploadFileDto: UploadFileDto,
  ) {
    return this.fileService.upload(account.id, file, uploadFileDto);
  }

  @Get('visits/:visitId/files')
  findManyByVisitId(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('visitId') visitId: string,
  ) {
    return this.fileService.findManyByVisitId(account.id, visitId);
  }

  @Get('files/:id/content')
  async read(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { stream, originalName } = await this.fileService.read(account.id, id);
    response.attachment(originalName);
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(stream);
  }

  @Put('files/:id')
  @UseInterceptors(FileInterceptor('file'))
  replace(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @UploadedFile() file: UploadedFilePayload | undefined,
  ) {
    return this.fileService.replace(account.id, id, file);
  }

  @Delete('files/:id')
  remove(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ) {
    return this.fileService.remove(account.id, id);
  }
}
