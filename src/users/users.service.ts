import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UserEntity, UserDocument } from './schemas/user.schema';
import { MailService } from './mail.service';
import { roleFor, SiteRole } from '../common/roles';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UserEntity.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(username: string, email: string, password: string): Promise<void> {
    const exists = await this.userModel.findOne({
      $or: [{ username }, { email }],
    });
    if (exists) {
      throw new BadRequestException(
        exists.username === username ? 'Username already taken' : 'Email already registered',
      );
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.userModel.create({ username, email, passwordHash });
  }

  async validateLogin(
    username: string,
    password: string,
  ): Promise<{ token: string; username: string; email: string; role: SiteRole }> {
    const user = await this.userModel.findOne({ username });
    if (!user) throw new UnauthorizedException('Invalid username or password');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid username or password');
    const role = roleFor(user.email);
    const token = this.jwtService.sign({
      sub: String(user._id),
      username: user.username,
      email: user.email,
      type: 'site-admin',
      role,
    });
    return { token, username: user.username, email: user.email, role };
  }

  async forgotPassword(email: string, appBaseUrl: string): Promise<void> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      return;
    }
    const resetToken = this.jwtService.sign(
      { email, type: 'password-reset' },
      { expiresIn: '1h' },
    );
    const resetUrl = `${appBaseUrl}/reset-password?token=${resetToken}`;
    await this.mailService.sendPasswordResetEmail(email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: { email: string; type: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Link หมดอายุหรือไม่ถูกต้อง');
    }
    if (payload.type !== 'password-reset') {
      throw new BadRequestException('Invalid token');
    }
    const user = await this.userModel.findOne({ email: payload.email });
    if (!user) throw new NotFoundException('User not found');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userModel.updateOne({ email: payload.email }, { passwordHash });
  }
}
