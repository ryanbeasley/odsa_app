import type { Request } from 'express';

declare module 'bcryptjs' {
  export function hashSync(data: string, salt: number): string;
  export function compareSync(data: string, encrypted: string): boolean;
}

declare module 'jsonwebtoken' {
  export interface JwtPayload {
    [key: string]: unknown;
  }

  export function sign(
    payload: Record<string, unknown>,
    secret: string,
    options?: { expiresIn?: string | number }
  ): string;

  export function verify(token: string, secret: string): JwtPayload;
}

declare global {
  interface Console {
    logEnter: (...params: unknown[]) => void;
    logRequest: (req: Request) => void;
  }
}

export {};
