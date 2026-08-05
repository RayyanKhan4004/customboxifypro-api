import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Session, SessionDocument } from '../schemas/session.schema';

export interface CreateSessionData {
  adminId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  device?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class SessionRepository {
  constructor(
    @InjectModel(Session.name) private readonly model: Model<SessionDocument>,
  ) {}

  async create(data: CreateSessionData): Promise<SessionDocument> {
    return this.model.create({
      adminId: new Types.ObjectId(data.adminId),
      familyId: data.familyId,
      tokenHash: data.tokenHash,
      prevHash: null,
      expiresAt: data.expiresAt,
      device: data.device ?? null,
      ip: data.ip ?? null,
      userAgent: data.userAgent ?? null,
    });
  }

  async findByTokenHash(tokenHash: string): Promise<SessionDocument | null> {
    return this.model.findOne({ tokenHash }).exec();
  }

  async findActiveByTokenHash(
    tokenHash: string,
  ): Promise<SessionDocument | null> {
    return this.model
      .findOne({ tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } })
      .exec();
  }

  async findActiveByAdmin(adminId: string): Promise<SessionDocument[]> {
    return this.model
      .find({
        adminId: new Types.ObjectId(adminId),
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .sort({ lastUsedAt: -1 })
      .lean()
      .exec() as Promise<SessionDocument[]>;
  }

  async findReuseByPrevHash(prevHash: string): Promise<SessionDocument | null> {
    return this.model.findOne({ prevHash }).exec();
  }

  async rotate(
    session: SessionDocument,
    newTokenHash: string,
    expiresAt: Date,
  ): Promise<SessionDocument> {
    const usedHash = session.tokenHash;
    session.tokenHash = newTokenHash;
    session.prevHash = usedHash;
    session.expiresAt = expiresAt;
    session.lastUsedAt = new Date();
    return session.save();
  }

  async revoke(sessionId: string): Promise<void> {
    await this.model
      .updateOne(
        { _id: sessionId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.model
      .updateMany(
        { familyId, revokedAt: null },
        { $set: { revokedAt: new Date(), reusedAt: new Date() } },
      )
      .exec();
  }

  async revokeAllForAdmin(
    adminId: string,
    excludeSessionId?: string,
  ): Promise<void> {
    const filter: Record<string, unknown> = {
      adminId: new Types.ObjectId(adminId),
      revokedAt: null,
    };
    if (excludeSessionId) filter._id = { $ne: excludeSessionId };
    await this.model
      .updateMany(filter, { $set: { revokedAt: new Date() } })
      .exec();
  }

  async findById(sessionId: string): Promise<SessionDocument | null> {
    return this.model.findById(sessionId).exec();
  }

  async listFamilySessionIds(familyId: string): Promise<string[]> {
    const sessions = await this.model
      .find({ familyId })
      .select('_id')
      .lean()
      .exec();
    return sessions.map((s) => String(s._id));
  }
}
