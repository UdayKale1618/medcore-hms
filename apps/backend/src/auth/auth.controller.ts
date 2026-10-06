import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from './auth-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // =========================
  // REGISTER
  // =========================
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // =========================
  // FORGOT PASSWORD
  // =========================
  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  // =========================
  // SEND EMAIL VERIFICATION OTP
  // =========================
  @Post('send-verification-otp')
  sendVerificationOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendVerificationOtp(sendOtpDto.email);
  }

  // =========================
  // VERIFY EMAIL OTP
  // =========================
  @Post('verify-otp')
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(
      verifyOtpDto.email,
      verifyOtpDto.otp,
    );
  }

  // =========================
  // RESET PASSWORD
  // =========================
  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  // =========================
  // LOGIN
  private getRefreshTokenCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    // For cross-site deployments (e.g. Frontend on Vercel, Backend on AWS EC2/Render),
    // SameSite must be 'none' and Secure must be true for the browser to send cross-origin cookies.
    // If frontend and backend share the same site or subdomains, COOKIE_SAME_SITE can be set to 'lax' or 'strict'.
    const sameSite: 'none' | 'lax' | 'strict' =
      (process.env.COOKIE_SAME_SITE as 'none' | 'lax' | 'strict') ||
      (isProduction ? 'none' : 'lax');

    const secure = isProduction ? true : process.env.COOKIE_SECURE === 'true';

    return {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  private getClearCookieOptions() {
    const { httpOnly, secure, sameSite } = this.getRefreshTokenCookieOptions();
    return {
      httpOnly,
      secure,
      sameSite,
    };
  }

  // =========================
  // LOGIN
  // =========================
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    response.cookie(
      'refreshToken',
      result.refreshToken,
      this.getRefreshTokenCookieOptions(),
    );

    return {
      message: result.message,
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  // =========================
  // REFRESH TOKEN
  // =========================
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.refreshToken;

    const result = await this.authService.refresh(refreshToken);

    response.cookie(
      'refreshToken',
      result.refreshToken,
      this.getRefreshTokenCookieOptions(),
    );

    return {
      message: 'Token refreshed successfully',
      accessToken: result.accessToken,
    };
  }

  // =========================
  // CURRENT USER
  // =========================
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: Request) {
    const user = request.user as AuthUser;

    return {
      message: 'Authenticated user',
      user,
    };
  }

  // =========================
  // LOGOUT
  // =========================
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = request.user as AuthUser;

    await this.authService.logout(user.userId);

    response.clearCookie('refreshToken', this.getClearCookieOptions());

    return {
      message: 'Logout successful',
    };
  }
}