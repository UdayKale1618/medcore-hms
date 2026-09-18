import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest();

    const authHeader =
      request.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith('Bearer ')
    ) {
      throw new UnauthorizedException(
        'Access token not provided',
      );
    }

    const token =
      authHeader.substring(7);

    try {
      const payload =
        await this.jwtService.verifyAsync(token, {
          secret:
            process.env.JWT_ACCESS_SECRET,
        });

      request.user = {
        userId: payload.sub,
        email: payload.email,
        roleId: payload.roleId,
        role: payload.role,
        hospitalId: payload.hospitalId,
      };

      return true;
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired access token',
      );
    }
  }
}