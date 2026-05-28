import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  adminCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  uploadCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  viewCode?: string;
}
