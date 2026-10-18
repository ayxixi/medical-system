import * as Joi from 'joi';

export interface AppEnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  FILE_STORAGE: 'local' | 's3';
  UPLOAD_PATH: string;
  MAX_FILE_SIZE_MB: number;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;
  S3_FORCE_PATH_STYLE?: 'true' | 'false';
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): AppEnvironmentVariables {
  const schema = Joi.object<AppEnvironmentVariables>({
    NODE_ENV: Joi.string()
      .valid('development', 'test', 'production')
      .default('development'),
    PORT: Joi.number().port().default(3000),
    DATABASE_URL: Joi.string().required(),
    FILE_STORAGE: Joi.string().valid('local', 's3').default('local'),
    UPLOAD_PATH: Joi.string().default('./uploads'),
    MAX_FILE_SIZE_MB: Joi.number().integer().positive().default(10),
    S3_REGION: Joi.string().when('FILE_STORAGE', {
      is: 's3',
      then: Joi.required(),
      otherwise: Joi.optional().allow(''),
    }),
    S3_BUCKET: Joi.string().when('FILE_STORAGE', {
      is: 's3',
      then: Joi.required(),
      otherwise: Joi.optional().allow(''),
    }),
    S3_ENDPOINT: Joi.string().uri().optional().allow(''),
    S3_ACCESS_KEY: Joi.string().optional().allow(''),
    S3_SECRET_KEY: Joi.string().optional().allow(''),
    S3_FORCE_PATH_STYLE: Joi.string().valid('true', 'false').optional(),
    JWT_SECRET: Joi.string().min(16).required(),
    JWT_EXPIRES_IN: Joi.string().default('1d'),
  }).unknown(true);

  const { error, value } = schema.validate(config, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    const message = error.details
      .map((detail) => translateJoiMessage(detail.message))
      .join('；');

    throw new Error(`环境变量校验失败：${message}`);
  }

  return value;
}

function translateJoiMessage(message: string): string {
  return message
    .replace(/^"([^"]+)" is required$/, '“$1” 为必填项')
    .replace(/^"([^"]+)" is not allowed to be empty$/, '“$1” 不能为空')
    .replace(
      /^"([^"]+)" length must be at least (\d+) characters long$/,
      '“$1” 长度不能少于 $2 个字符',
    )
    .replace(/^"([^"]+)" must be a valid uri$/, '“$1” 必须是有效的 URI')
    .replace(/^"([^"]+)" must be one of \[(.+)\]$/, '“$1” 必须是以下值之一：$2');
}
