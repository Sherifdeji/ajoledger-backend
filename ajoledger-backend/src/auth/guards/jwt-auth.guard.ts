import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Reusable guard for all JWT-protected routes.
 * Validates the Authorization: Bearer <token> header.
 * Populates req.user with { id, phone } on success.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
