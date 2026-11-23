import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateHealthReminderDto } from './dto/create-health-reminder.dto';
import { HealthReminderActionDto } from './dto/health-reminder-action.dto';
import { UpdateHealthReminderDto } from './dto/update-health-reminder.dto';
import { HealthReminderRepository } from './health-reminder.repository';
import { HealthReminderService } from './health-reminder.service';
import { HealthReminderAction, HealthReminderKind } from './health-reminder.types';

describe('HealthReminderService', () => {
  let service: HealthReminderService;
  let repository: {
    userExistsForAccount: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    findByIdForAccount: jest.Mock;
    updateForAccount: jest.Mock;
    deleteForAccount: jest.Mock;
  };

  const oneTimeReminder = (overrides: Record<string, unknown> = {}) => ({
    id: 'reminder-1',
    userId: 'user-1',
    kind: HealthReminderKind.Temperature,
    title: '测量体温',
    note: null,
    nextAt: new Date('2026-11-23T13:00:00.000Z'),
    localTime: null,
    timeZone: 'Asia/Shanghai',
    repeatDaily: false,
    snoozedUntil: null,
    isActive: true,
    completedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      userExistsForAccount: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findByIdForAccount: jest.fn(),
      updateForAccount: jest.fn(),
      deleteForAccount: jest.fn(),
    };
    service = new HealthReminderService(repository as unknown as HealthReminderRepository);
  });

  afterEach(() => jest.useRealTimers());

  it('rejects creating a reminder for a member outside the account', async () => {
    repository.userExistsForAccount.mockResolvedValue(false);
    const dto = {
      userId: 'foreign-user',
      kind: HealthReminderKind.Medication,
      title: '记录服药',
      nextAt: new Date('2026-11-23T13:00:00.000Z'),
      timeZone: 'Asia/Shanghai',
      repeatDaily: false,
    } as CreateHealthReminderDto;

    await expect(service.create('account-1', dto)).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('creates a one-time reminder with no recurrence time', async () => {
    repository.userExistsForAccount.mockResolvedValue(true);
    repository.create.mockImplementation(async (data) => data);
    const nextAt = new Date('2026-11-23T13:00:00.000Z');

    await service.create('account-1', {
      userId: 'user-1',
      kind: HealthReminderKind.Temperature,
      title: '量体温',
      note: '醒来后',
      nextAt,
      timeZone: 'Asia/Shanghai',
      repeatDaily: false,
    } as CreateHealthReminderDto);

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      kind: HealthReminderKind.Temperature,
      nextAt,
      timeZone: 'Asia/Shanghai',
      repeatDaily: false,
      localTime: null,
    }));
  });

  it('moves a daily reminder to the first valid local time when DST skips the requested minute', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-08T05:00:00.000Z'));
    repository.userExistsForAccount.mockResolvedValue(true);
    repository.create.mockImplementation(async (data) => data);

    const result = await service.create('account-1', {
      userId: 'user-1',
      kind: HealthReminderKind.Medication,
      title: '记录服药',
      nextAt: new Date('2026-03-08T07:30:00.000Z'),
      localTime: '02:30',
      timeZone: 'America/New_York',
      repeatDaily: true,
    } as CreateHealthReminderDto);

    expect(result.nextAt).toEqual(new Date('2026-03-08T07:00:00.000Z'));
    expect(result.localTime).toBe('02:30');
  });

  it('uses the second matching wall-clock time when DST repeats an hour', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-01T05:45:00.000Z'));
    repository.userExistsForAccount.mockResolvedValue(true);
    repository.create.mockImplementation(async (data) => data);

    const result = await service.create('account-1', {
      userId: 'user-1',
      kind: HealthReminderKind.Temperature,
      title: '测量体温',
      nextAt: new Date('2026-11-01T06:30:00.000Z'),
      localTime: '01:30',
      timeZone: 'America/New_York',
      repeatDaily: true,
    } as CreateHealthReminderDto);

    expect(result.nextAt).toEqual(new Date('2026-11-01T06:30:00.000Z'));
  });

  it('rejects invalid time zones and missing daily local time', async () => {
    repository.userExistsForAccount.mockResolvedValue(true);
    const base = {
      userId: 'user-1',
      kind: HealthReminderKind.Custom,
      title: '提醒',
      nextAt: new Date('2026-11-23T13:00:00.000Z'),
      timeZone: 'Invalid/Zone',
      repeatDaily: false,
    };

    await expect(service.create('account-1', base as CreateHealthReminderDto))
      .rejects.toThrow(BadRequestException);
    await expect(service.create('account-1', {
      ...base,
      timeZone: 'Asia/Shanghai',
      repeatDaily: true,
    } as CreateHealthReminderDto)).rejects.toThrow('每日提醒需要有效的本地时间');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('recomputes the next daily occurrence when editing the scheduled time', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-23T14:00:00.000Z'));
    repository.findByIdForAccount.mockResolvedValue(oneTimeReminder({
      repeatDaily: true,
      localTime: '19:00',
      nextAt: new Date('2026-11-23T11:00:00.000Z'),
    }));
    repository.updateForAccount.mockResolvedValue(oneTimeReminder({ nextAt: new Date('2026-11-24T12:00:00.000Z') }));

    await service.update('account-1', 'reminder-1', {
      repeatDaily: true,
      localTime: '20:00',
      timeZone: 'Asia/Shanghai',
      nextAt: new Date('2026-11-23T11:00:00.000Z'),
    } as UpdateHealthReminderDto);

    expect(repository.updateForAccount).toHaveBeenCalledWith('reminder-1', 'account-1', expect.objectContaining({
      nextAt: new Date('2026-11-24T12:00:00.000Z'),
    }));
  });

  it('snoozes a reminder for ten minutes without changing its daily schedule', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-23T12:00:00.000Z'));
    const reminder = oneTimeReminder({ repeatDaily: true, localTime: '20:00' });
    repository.findByIdForAccount.mockResolvedValue(reminder);
    repository.updateForAccount.mockResolvedValue(reminder);

    await service.act('account-1', 'reminder-1', {
      action: HealthReminderAction.Snooze,
    } as HealthReminderActionDto);

    expect(repository.updateForAccount).toHaveBeenCalledWith('reminder-1', 'account-1', {
      snoozedUntil: new Date('2026-11-23T12:10:00.000Z'),
    });
  });

  it('advances a completed daily reminder to the next local calendar day', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-23T12:10:00.000Z'));
    repository.findByIdForAccount.mockResolvedValue(oneTimeReminder({
      repeatDaily: true,
      localTime: '20:00',
      nextAt: new Date('2026-11-23T12:00:00.000Z'),
      snoozedUntil: new Date('2026-11-23T12:10:00.000Z'),
    }));
    repository.updateForAccount.mockResolvedValue(oneTimeReminder());

    await service.act('account-1', 'reminder-1', {
      action: HealthReminderAction.Complete,
    } as HealthReminderActionDto);

    expect(repository.updateForAccount).toHaveBeenCalledWith('reminder-1', 'account-1', {
      nextAt: new Date('2026-11-24T12:00:00.000Z'),
      snoozedUntil: null,
    });
  });

  it('deactivates a completed one-time reminder', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-23T12:10:00.000Z'));
    repository.findByIdForAccount.mockResolvedValue(oneTimeReminder());
    repository.updateForAccount.mockResolvedValue(oneTimeReminder({ isActive: false }));

    await service.act('account-1', 'reminder-1', {
      action: HealthReminderAction.Complete,
    } as HealthReminderActionDto);

    expect(repository.updateForAccount).toHaveBeenCalledWith('reminder-1', 'account-1', {
      isActive: false,
      completedAt: new Date('2026-11-23T12:10:00.000Z'),
      snoozedUntil: null,
    });
  });

  it('rejects completing a paused reminder', async () => {
    repository.findByIdForAccount.mockResolvedValue(oneTimeReminder({ isActive: false }));

    await expect(service.act('account-1', 'reminder-1', {
      action: HealthReminderAction.Complete,
    } as HealthReminderActionDto)).rejects.toThrow(BadRequestException);
    expect(repository.updateForAccount).not.toHaveBeenCalled();
  });

  it('rejects a blank title and hides a reminder not owned by the account', async () => {
    repository.findByIdForAccount.mockResolvedValue(oneTimeReminder());
    await expect(service.update('account-1', 'reminder-1', { title: '   ' } as UpdateHealthReminderDto))
      .rejects.toThrow(BadRequestException);

    repository.findByIdForAccount.mockResolvedValue(null);
    await expect(service.update('account-2', 'reminder-1', { title: '改标题' } as UpdateHealthReminderDto))
      .rejects.toThrow(NotFoundException);
    expect(repository.updateForAccount).not.toHaveBeenCalled();
  });
});
