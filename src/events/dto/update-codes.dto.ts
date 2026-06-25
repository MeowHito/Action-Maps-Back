import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Empty string clears a code; omitted field leaves it unchanged. */
export class UpdateCodesDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  adminCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  uploadCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  viewCode?: string;
}
