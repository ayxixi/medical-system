import { ValidationError } from 'class-validator';

export function formatValidationErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => flattenValidationError(error));
}

function flattenValidationError(
  error: ValidationError,
  parentPath?: string,
): string[] {
  const path = parentPath ? `${parentPath}.${error.property}` : error.property;
  const messages = error.constraints
    ? Object.entries(error.constraints).map(([type, message]) =>
        translateConstraint(type, path, message),
      )
    : [];

  if (!error.children?.length) {
    return messages;
  }

  return [
    ...messages,
    ...error.children.flatMap((child) => flattenValidationError(child, path)),
  ];
}

function translateConstraint(
  type: string,
  path: string,
  originalMessage: string,
): string {
  switch (type) {
    case 'isString':
      return `字段 ${path} 必须是字符串`;
    case 'isNotEmpty':
      return `字段 ${path} 不能为空`;
    case 'isEmail':
      return `字段 ${path} 必须是有效的邮箱地址`;
    case 'isDate':
      return `字段 ${path} 必须是有效的日期`;
    case 'minLength': {
      const length = extractFirstNumber(originalMessage);
      return length
        ? `字段 ${path} 长度不能少于 ${length} 个字符`
        : `字段 ${path} 长度不符合最小限制`;
    }
    case 'maxLength': {
      const length = extractFirstNumber(originalMessage);
      return length
        ? `字段 ${path} 长度不能超过 ${length} 个字符`
        : `字段 ${path} 长度超出限制`;
    }
    case 'whitelistValidation':
      return `不允许提交字段 ${path}`;
    default:
      return `字段 ${path} 校验失败`;
  }
}

function extractFirstNumber(message: string): number | undefined {
  const match = message.match(/\d+/);

  return match ? Number(match[0]) : undefined;
}
