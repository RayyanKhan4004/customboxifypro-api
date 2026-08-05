import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Admin, AdminDocument } from '../schemas/admin.schema';

type MongoFilter = Record<string, unknown>;

@Injectable()
export class AdminRepository {
  constructor(
    @InjectModel(Admin.name) private readonly model: Model<AdminDocument>,
  ) {}

  async findById(id: string): Promise<AdminDocument | null> {
    return this.model.findById(id).exec();
  }

  async findByIdLean(id: string): Promise<AdminDocument | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<AdminDocument | null>;
  }

  async findByEmail(email: string): Promise<AdminDocument | null> {
    return this.model
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash +passwordResetTokenHash +invitationTokenHash')
      .exec();
  }

  async findByIdWithSecrets(id: string): Promise<AdminDocument | null> {
    return this.model
      .findById(id)
      .select(
        '+passwordHash +passwordResetTokenHash +invitationTokenHash +twoFactorSecretEncrypted',
      )
      .exec();
  }

  async findActiveById(id: string): Promise<AdminDocument | null> {
    return this.model
      .findOne({ _id: id, status: 'active', deletedAt: null })
      .exec();
  }

  async findByPasswordResetTokenHash(
    hash: string,
  ): Promise<AdminDocument | null> {
    return this.model
      .findOne({ passwordResetTokenHash: hash })
      .select('+passwordHash +passwordResetTokenHash +invitationTokenHash')
      .exec();
  }

  async countByEmail(email: string, excludeId?: string): Promise<number> {
    const filter: MongoFilter = { email: email.toLowerCase(), deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.model.countDocuments(filter).exec();
  }

  async create(data: Partial<Admin>): Promise<AdminDocument> {
    return this.model.create(data);
  }

  async update(
    id: string,
    data: Partial<Admin>,
  ): Promise<AdminDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .select('+passwordHash')
      .exec();
  }

  async list(filter: MongoFilter, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const result = await this.model
      .updateOne(
        { _id: id, deletedAt: null },
        {
          $set: {
            deletedAt: new Date(),
            deletedBy: new Types.ObjectId(deletedBy),
          },
        },
      )
      .exec();
    return result.modifiedCount > 0;
  }
}
