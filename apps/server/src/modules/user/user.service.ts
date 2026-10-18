import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  create(accountId: string, createUserDto: CreateUserDto) {
    return this.userRepository.create({
      accountId,
      name: createUserDto.name,
    });
  }

  findMany(accountId: string) {
    return this.userRepository.findManyByAccount(accountId);
  }

  async findById(accountId: string, id: string) {
    const user = await this.userRepository.findByIdForAccount(id, accountId);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  async update(accountId: string, id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.updateForAccount(id, accountId, {
      name: updateUserDto.name,
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  async remove(accountId: string, id: string) {
    const existing = await this.userRepository.findByIdForAccount(id, accountId);

    if (!existing) {
      throw new NotFoundException('用户不存在');
    }

    const total = await this.userRepository.countByAccount(accountId);

    if (total <= 1) {
      throw new BadRequestException('账号下至少需要保留一个用户');
    }

    await this.userRepository.deleteForAccount(id, accountId);

    return { id };
  }
}
