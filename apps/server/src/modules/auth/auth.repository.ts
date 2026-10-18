import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAccountByEmail(email: string) {
    return this.prisma.account.findUnique({
      where: { email },
    });
  }

  findAccountById(id: string) {
    return this.prisma.account.findUnique({
      where: { id },
      select: { id: true, email: true, createdAt: true },
    });
  }

  createAccountWithFirstUser(data: {
    email: string;
    passwordHash: string;
    name: string;
  }) {
    return this.prisma.account.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        users: {
          create: { name: data.name },
        },
      },
      include: {
        users: true,
      },
    });
  }
}
