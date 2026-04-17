import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRouteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^#?[0-9a-fA-F]{6}$/, { message: 'color must be a hex color like #3399ff' })
  color?: string;
}
