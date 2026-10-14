import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.ensureInitialSeed();
  }

  async ensureInitialSeed() {
    try {
      const roles = [
        { name: 'SUPER_ADMIN', description: 'System administrator with cross-hospital access' },
        { name: 'HOSPITAL_ADMIN', description: 'Hospital executive & administrative operations' },
        { name: 'DOCTOR', description: 'Doctor managing clinical consultations & medical records' },
        { name: 'NURSE', description: 'Nurse managing inpatient care, vitals & ward rounds' },
        { name: 'RECEPTIONIST', description: 'Receptionist managing patient registration & front desk' },
        { name: 'LAB_TECHNICIAN', description: 'Laboratory technician processing diagnostics & reports' },
        { name: 'PHARMACIST', description: 'Pharmacist managing pharmacy inventory & dispensing' },
        { name: 'ACCOUNTANT', description: 'Financial accountant managing billing, invoices & payments' },
        { name: 'PATIENT', description: 'Hospital patient with patient portal access' },
      ];

      for (const r of roles) {
        await this.prisma.role.upsert({
          where: { name: r.name },
          update: {},
          create: r,
        });
      }

      const hospitalCount = await this.prisma.hospital.count();
      if (hospitalCount === 0) {
        await this.prisma.hospital.create({
          data: {
            name: 'MedCore Central Hospital',
            email: 'admin@medcore.com',
            phone: '+91 9876543210',
            addresses: {
              create: {
                addressLine1: '100 Healthcare Blvd',
                city: 'Bengaluru',
                state: 'Karnataka',
                postalCode: '560001',
                country: 'India',
              },
            },
          },
        });

        await this.prisma.hospital.create({
          data: {
            name: 'Apollo Specialty Hospital',
            email: 'admin@apollo.com',
            phone: '+91 80 2630 4050',
            addresses: {
              create: {
                addressLine1: '154/11 Bannerghatta Road',
                city: 'Bengaluru',
                state: 'Karnataka',
                postalCode: '560076',
                country: 'India',
              },
            },
          },
        });
      }
    } catch {
      // Non-fatal if DB is initializing or in mock mode during unit tests
    }
  }

  // =========================================================
  // PUBLIC HOSPITALS (For Registration Selection)
  // =========================================================
  async getPublicHospitals() {
    let hospitals = await this.prisma.hospital.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        addresses: {
          select: {
            city: true,
            state: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    if (hospitals.length === 0) {
      await this.ensureInitialSeed();
      hospitals = await this.prisma.hospital.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          addresses: {
            select: {
              city: true,
              state: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    }

    return hospitals;
  }

  // =========================================================
  // REGISTER (Public Self-Registration: Strictly Patients)
  // =========================================================

  async register(registerDto: RegisterDto) {
    const {
      name,
      email,
      phone,
      password,
      hospitalId,
      roleId,
    } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new UnauthorizedException('Invalid hospital');
    }

    // Role resolution and privilege escalation protection:
    // Public registration MUST strictly assign PATIENT. Privileged staff roles must be provisioned by admins.
    let role;
    if (roleId) {
      role = await this.prisma.role.findUnique({
        where: { id: roleId },
      });

      if (!role) {
        throw new UnauthorizedException('Invalid role');
      }

      if (role.name !== 'PATIENT') {
        throw new ForbiddenException(
          'Public registration is only permitted for patients. Staff accounts must be provisioned by hospital administrators.',
        );
      }
    } else {
      role = await this.prisma.role.findUnique({
        where: { name: 'PATIENT' },
      });

      if (!role) {
        throw new NotFoundException('Patient role not found in system');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash: hashedPassword,
        hospitalId,
        roleId: role.id,
      },
      include: {
        role: true,
        hospital: true,
      },
    });

    // Automatically create Patient entity for the new patient user
    if (role.name === 'PATIENT') {
      await this.prisma.patient.create({
        data: {
          userId: user.id,
          hospitalId: user.hospitalId,
        },
      });
    }

    // Generate initial 6-digit email verification OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.emailVerificationOtp.create({
      data: {
        userId: user.id,
        otp,
        expiresAt,
      },
    });

    return {
      message: 'Registration successful. Please verify your email with the 6-digit OTP code.',
      otp, // included for development / evaluation
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        role: user.role.name,
        hospitalId: user.hospitalId,
        hospital: user.hospital.name,
      },
    };
  }

  // =========================================================
  // LOGIN
  // =========================================================

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    // JWT payload
    const payload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      role: user.role.name,
      hospitalId: user.hospitalId,
    };

    const accessToken = await this.jwtService.signAsync(
      payload,
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      payload,
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    const deviceId = 'default';

    await this.redisService.set(
      `rt:${user.id}:${deviceId}`,
      refreshToken,
      7 * 24 * 60 * 60,
    );

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        role: user.role.name,
        hospitalId: user.hospitalId,
      },
    };
  }

  // =========================================================
  // REFRESH TOKEN
  // =========================================================

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException(
        'Refresh token not provided',
      );
    }

    try {
      const payload =
        await this.jwtService.verifyAsync(refreshToken, {
          secret: process.env.JWT_REFRESH_SECRET,
        });

      const userId = payload.sub;
      const deviceId = 'default';

      const storedToken = await this.redisService.get(
        `rt:${userId}:${deviceId}`,
      );

      if (!storedToken) {
        throw new UnauthorizedException(
          'Refresh token expired or revoked',
        );
      }

      if (storedToken !== refreshToken) {
        throw new UnauthorizedException(
          'Invalid refresh token',
        );
      }

      // Include role in the new JWT payload
      const newPayload = {
        sub: payload.sub,
        email: payload.email,
        roleId: payload.roleId,
        role: payload.role,
        hospitalId: payload.hospitalId,
      };

      const newAccessToken =
        await this.jwtService.signAsync(
          newPayload,
          {
            secret: process.env.JWT_ACCESS_SECRET,
            expiresIn: '15m',
          },
        );

      const newRefreshToken =
        await this.jwtService.signAsync(
          newPayload,
          {
            secret: process.env.JWT_REFRESH_SECRET,
            expiresIn: '7d',
          },
        );

      // Refresh token rotation
      await this.redisService.set(
        `rt:${userId}:${deviceId}`,
        newRefreshToken,
        7 * 24 * 60 * 60,
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(
        'Invalid or expired refresh token',
      );
    }
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  async logout(userId: string) {
    const deviceId = 'default';

    await this.redisService.delete(
      `rt:${userId}:${deviceId}`,
    );

    return {
      message: 'Logout successful',
    };
  }

  // =========================================================
  // FORGOT PASSWORD
  // =========================================================

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const resetToken = randomBytes(32).toString('hex');

    const expiresAt = new Date(
      Date.now() + 15 * 60 * 1000,
    );

    await this.prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    });

    // Temporary development response.
    // Later this token should be sent through email.
    return {
      message:
        'Password reset token generated successfully',
      resetToken,
    };
  }

  // =========================================================
  // RESET PASSWORD
  // =========================================================

  async resetPassword(
    token: string,
    newPassword: string,
  ) {
    const resetToken =
      await this.prisma.passwordResetToken.findUnique({
        where: {
          token,
        },
      });

    if (!resetToken) {
      throw new UnauthorizedException(
        'Invalid reset token',
      );
    }

    if (resetToken.expiresAt < new Date()) {
      await this.prisma.passwordResetToken.delete({
        where: {
          id: resetToken.id,
        },
      });

      throw new UnauthorizedException(
        'Reset token has expired',
      );
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      12,
    );

    await this.prisma.user.update({
      where: {
        id: resetToken.userId,
      },
      data: {
        passwordHash: hashedPassword,
      },
    });

    await this.prisma.passwordResetToken.delete({
      where: {
        id: resetToken.id,
      },
    });

    // Invalidate existing refresh token
    await this.redisService.delete(
      `rt:${resetToken.userId}:default`,
    );

    return {
      message: 'Password reset successful',
    };
  }

  // =========================================================
  // SEND EMAIL VERIFICATION OTP
  // =========================================================

  async sendVerificationOtp(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.emailVerified) {
      return {
        message: 'Email is already verified',
      };
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000,
    );

    // Remove previous OTPs
    await this.prisma.emailVerificationOtp.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await this.prisma.emailVerificationOtp.create({
      data: {
        userId: user.id,
        otp,
        expiresAt,
      },
    });

    // Temporary development response.
    // Later send OTP through an email service.
    return {
      message:
        'Verification OTP generated successfully',
      otp,
    };
  }

  // =========================================================
  // VERIFY EMAIL OTP
  // =========================================================

  async verifyOtp(
    email: string,
    otp: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.emailVerified) {
      return {
        message: 'Email is already verified',
      };
    }

    const verificationOtp =
      await this.prisma.emailVerificationOtp.findFirst({
        where: {
          userId: user.id,
          otp,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (!verificationOtp) {
      throw new UnauthorizedException(
        'Invalid OTP',
      );
    }

    if (verificationOtp.expiresAt < new Date()) {
      await this.prisma.emailVerificationOtp.delete({
        where: {
          id: verificationOtp.id,
        },
      });

      throw new UnauthorizedException(
        'OTP has expired',
      );
    }

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: true,
      },
    });

    await this.prisma.emailVerificationOtp.delete({
      where: {
        id: verificationOtp.id,
      },
    });

    return {
      message: 'Email verified successfully',
    };
  }
}