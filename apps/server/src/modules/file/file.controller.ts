import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
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
