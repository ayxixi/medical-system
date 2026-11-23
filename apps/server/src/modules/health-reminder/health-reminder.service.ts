import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateHealthReminderDto } from './dto/create-health-reminder.dto';
import { HealthReminderActionDto } from './dto/health-reminder-action.dto';
import { ListHealthRemindersQueryDto } from './dto/list-health-reminders.query';
import { UpdateHealthReminderDto } from './dto/update-health-reminder.dto';
import { HealthReminderRepository } from './health-reminder.repository';
import { HealthReminderAction, HealthReminderKind } from './health-reminder.types';

interface ReminderSchedule {
  repeatDaily: boolean;
  localTime?: string | null;
  timeZone: string;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function isValidLocalTime(value?: string | null): value is string {
  return Boolean(value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
}

function nextDailyOccurrence(localTime: string, timeZone: string, after: Date): Date {
  const [hour, minute] = localTime.split(':').map(Number);
  const today = zonedParts(after, timeZone);

  for (let offset = 0; offset < 3; offset += 1) {
    const calendarDate = new Date(Date.UTC(today.year, today.month - 1, today.day + offset, 12));
    const target = {
      year: calendarDate.getUTCFullYear(),
      month: calendarDate.getUTCMonth() + 1,
      day: calendarDate.getUTCDate(),
      hour,
      minute,
    };
    const targetWallClockAsUtc = Date.UTC(target.year, target.month - 1, target.day, hour, minute);
    let candidate = targetWallClockAsUtc;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const actual = zonedParts(new Date(candidate), timeZone);
      const actualWallClockAsUtc = Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
      );
      const difference = targetWallClockAsUtc - actualWallClockAsUtc;
      if (difference === 0) break;
      candidate += difference;
    }

    let occurrence = new Date(candidate);
    let actual = zonedParts(occurrence, timeZone);
    // If a daylight-saving transition skips this local time, use the first
    // valid minute after it on the same local calendar day.
    if (
      actual.year === target.year && actual.month === target.month && actual.day === target.day &&
      (actual.hour < hour || (actual.hour === hour && actual.minute < minute))
    ) {
      const limit = candidate + 180 * 60_000;
      while (candidate < limit) {
        candidate += 60_000;
        actual = zonedParts(new Date(candidate), timeZone);
        if (
          actual.year !== target.year || actual.month !== target.month || actual.day !== target.day
        ) break;
        if (actual.hour > hour || (actual.hour === hour && actual.minute >= minute)) {
          occurrence = new Date(candidate);
          break;
        }
      }
    }

    if (occurrence.getTime() > after.getTime()) return occurrence;
  }

  throw new BadRequestException('无法计算下一次每日提醒时间');
}

@Injectable()
export class HealthReminderService {
  constructor(private readonly repository: HealthReminderRepository) {}

  async create(accountId: string, dto: CreateHealthReminderDto) {
    if (!(await this.repository.userExistsForAccount(dto.userId, accountId))) {
      throw new NotFoundException('家庭成员不存在');
    }
    this.validateSchedule(dto);
    const nextAt = dto.repeatDaily
      ? nextDailyOccurrence(dto.localTime as string, dto.timeZone, new Date())
      : dto.nextAt;
    return this.repository.create({
      userId: dto.userId,
      kind: dto.kind,
      title: dto.title,
      note: dto.note,
      nextAt,
      localTime: dto.repeatDaily ? dto.localTime : null,
      timeZone: dto.timeZone,
      repeatDaily: dto.repeatDaily,
    });
  }

  async findMany(accountId: string, query: ListHealthRemindersQueryDto) {
    if (query.userId && !(await this.repository.userExistsForAccount(query.userId, accountId))) {
      throw new NotFoundException('家庭成员不存在');
    }
    return this.repository.findMany({
      accountId,
      userId: query.userId,
      includeInactive: query.includeInactive,
    });
  }

  async update(accountId: string, id: string, dto: UpdateHealthReminderDto) {
    const existing = await this.getForAccount(id, accountId);
    if (dto.title !== undefined && !dto.title?.trim()) {
      throw new BadRequestException('提醒内容不能为空');
    }
    const repeatDaily = dto.repeatDaily ?? existing.repeatDaily;
    const localTime = dto.localTime === undefined ? existing.localTime : dto.localTime;
    const timeZone = dto.timeZone ?? existing.timeZone;
    this.validateSchedule({ repeatDaily, localTime, timeZone });

    const scheduleChanged = dto.nextAt !== undefined || dto.localTime !== undefined ||
      dto.timeZone !== undefined || dto.repeatDaily !== undefined;
    const nextAt = scheduleChanged
      ? (repeatDaily
        ? nextDailyOccurrence(localTime as string, timeZone, new Date())
        : dto.nextAt ?? existing.nextAt)
      : undefined;
    const { title, ...changes } = dto;
    const result = await this.repository.updateForAccount(id, accountId, {
      ...changes,
      ...(title != null ? { title } : {}),
      ...(nextAt ? { nextAt } : {}),
      ...(dto.repeatDaily === false ? { localTime: null, snoozedUntil: null } : {}),
      ...(dto.isActive === false ? { snoozedUntil: null } : {}),
    });
    if (!result) throw new NotFoundException('提醒不存在');
    return result;
  }

  async act(accountId: string, id: string, dto: HealthReminderActionDto) {
    const reminder = await this.getForAccount(id, accountId);
    if (!reminder.isActive || reminder.completedAt) {
      throw new BadRequestException('此提醒当前不可处理');
    }

    if (dto.action === HealthReminderAction.Snooze) {
      const updated = await this.repository.updateForAccount(id, accountId, {
        snoozedUntil: new Date(Date.now() + 10 * 60_000),
      });
      if (!updated) throw new NotFoundException('提醒不存在');
      return updated;
    }

    const now = new Date();
    const data = reminder.repeatDaily
      ? {
          nextAt: nextDailyOccurrence(reminder.localTime as string, reminder.timeZone, now),
          snoozedUntil: null,
        }
      : { isActive: false, completedAt: now, snoozedUntil: null };
    const updated = await this.repository.updateForAccount(id, accountId, data);
    if (!updated) throw new NotFoundException('提醒不存在');
    return updated;
  }

  async remove(accountId: string, id: string): Promise<void> {
    if (!(await this.repository.deleteForAccount(id, accountId))) {
      throw new NotFoundException('提醒不存在');
    }
  }

  private async getForAccount(id: string, accountId: string) {
    const reminder = await this.repository.findByIdForAccount(id, accountId);
    if (!reminder) throw new NotFoundException('提醒不存在');
    return reminder;
  }

  private validateSchedule(schedule: ReminderSchedule) {
    if (!isValidTimeZone(schedule.timeZone)) {
      throw new BadRequestException('时区不是有效的 IANA 时区');
    }
    if (schedule.repeatDaily && !isValidLocalTime(schedule.localTime)) {
      throw new BadRequestException('每日提醒需要有效的本地时间');
    }
  }
}
