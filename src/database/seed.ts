import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Admin, AdminDocument } from '../admins/schemas/admin.schema';
import { AppModule } from '../app.module';
import { PasswordService } from '../common/security/password.service';
import { ALL_PERMISSIONS } from '../roles/permissions';
import { Role, RoleDocument } from '../roles/schemas/role.schema';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const config = app.get(ConfigService);
    const email = config.get<string>('SEED_SUPER_ADMIN_EMAIL')?.toLowerCase();
    const password = config.get<string>('SEED_SUPER_ADMIN_PASSWORD');
    const name = config.get<string>('SEED_SUPER_ADMIN_NAME') ?? 'Super Admin';

    if (!email || !password) {
      throw new Error(
        'SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD are required.',
      );
    }

    const roles = app.get<Model<RoleDocument>>(getModelToken(Role.name));
    const admins = app.get<Model<AdminDocument>>(getModelToken(Admin.name));
    const passwordService = app.get(PasswordService);

    const role = await roles.findOneAndUpdate(
      { key: 'super-admin' },
      {
        $set: {
          name: 'Super Admin',
          description: 'Full system access',
          permissions: ALL_PERMISSIONS,
          isSystem: true,
          status: 'active',
        },
      },
      { returnDocument: 'after', upsert: true },
    );

    const existingAdmin = await admins.findOne({ email, deletedAt: null });
    if (existingAdmin) {
      await admins.updateOne(
        { _id: existingAdmin._id },
        { $set: { roleId: role._id, status: 'active' } },
      );
      process.stdout.write(
        'Super admin already exists; role and status verified.\n',
      );
      return;
    }

    await admins.create({
      email,
      name,
      passwordHash: await passwordService.hash(password),
      roleId: role._id,
      status: 'active',
    });
    process.stdout.write('Super admin created.\n');
  } finally {
    await app.close();
  }
}

void seed().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown seed error';
  process.stderr.write(`Seed failed: ${message}\n`);
  process.exitCode = 1;
});
