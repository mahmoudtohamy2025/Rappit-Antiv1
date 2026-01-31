import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  firstName?: string; // Optional: user provides this when accepting invite

  @IsOptional()
  @IsString()
  lastName?: string; // Optional: user provides this when accepting invite

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string; // Optional: if not provided, a random password will be generated

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole; // Default: OPERATOR
}
