import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    await this.usersService.register(dto.username, dto.email, dto.password);
    return { ok: true };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const token = await this.usersService.validateLogin(dto.username, dto.password);
    return { username: dto.username, token };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    await this.usersService.forgotPassword(dto.email, appBaseUrl);
    return { ok: true };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.usersService.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }
}
