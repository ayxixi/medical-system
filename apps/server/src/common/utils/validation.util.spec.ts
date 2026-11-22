import { ValidationError } from 'class-validator';
import { formatValidationErrors } from './validation.util';

describe('formatValidationErrors', () => {
  it('translates known constraints, flattens nested fields and preserves useful paths', () => {
    const error = {
      property: 'profile',
      constraints: { isString: 'name must be a string', customValidation: 'bad' },
      children: [{ property: 'email', constraints: { isEmail: 'email must be an email' }, children: [] }],
    } as ValidationError;
    expect(formatValidationErrors([error])).toEqual([
      '字段 profile 必须是字符串', '字段 profile 校验失败', '字段 profile.email 必须是有效的邮箱地址',
    ]);
  });

  it('handles length, whitelist, date and empty validation errors', () => {
    expect(formatValidationErrors([
      { property: 'name', constraints: { minLength: 'name must be longer than or equal to 3 characters' } },
      { property: 'note', constraints: { maxLength: 'note must be shorter than or equal to 1000 characters' } },
      { property: 'extra', constraints: { whitelistValidation: 'property extra should not exist' } },
      { property: 'date', constraints: { isDate: 'date must be a valid date' } },
      { property: 'missing' },
    ] as ValidationError[])).toEqual([
      '字段 name 长度不能少于 3 个字符', '字段 note 长度不能超过 1000 个字符',
      '不允许提交字段 extra', '字段 date 必须是有效的日期',
    ]);
  });
});
