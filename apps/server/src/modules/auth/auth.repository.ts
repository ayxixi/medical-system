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

  findAccountByLoginIdentifier(identifier: string) {
    return this.prisma.account.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    });
  }

  findAccountByUsername(username: string) {
    return this.prisma.account.findUnique({ where: { username } });
  }

  findAccountById(id: string) {
    return this.prisma.account.findUnique({
      where: { id },
      select: { id: true, email: true, username: true, createdAt: true, tokenVersion: true },
    });
  }

  findLoginAttempt(key: string) {
    return this.prisma.loginAttempt.findUnique({ where: { key } });
  }

  saveLoginAttempt(key: string, data: { windowStart: bigint; count: number; blockedUntil: bigint }) {
    return this.prisma.loginAttempt.upsert({
      where: { key },
      create: { key, ...data },
      update: data,
    });
  }

  clearLoginAttempt(key: string) {
    return this.prisma.loginAttempt.deleteMany({ where: { key } });
  }

  changePassword(accountId: string, passwordHash: string) {
    return this.prisma.account.update({
      where: { id: accountId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
      select: { id: true, email: true, tokenVersion: true },
    });
  }

  findAccountByIdWithCredentials(id: string) {
    return this.prisma.account.findUnique({ where: { id } });
  }

  setUsername(id: string, username: string) {
    return this.prisma.account.update({ where: { id }, data: { username } });
  }

  createAccountWithFirstUser(data: {
    email: string;
    username: string;
    passwordHash: string;
    name: string;
  }) {
    return this.prisma.account.create({
      data: {
        email: data.email,
        username: data.username,
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
