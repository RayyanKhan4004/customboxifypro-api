import { Injectable } from '@nestjs/common';
import { hash, verify, Algorithm } from '@node-rs/argon2';

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return hash(password, { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 3, parallelism: 1 });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await verify(hash, password);
    } catch {
      return false;
    }
  }
}
