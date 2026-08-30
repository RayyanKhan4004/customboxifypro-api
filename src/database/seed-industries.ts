import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { slugify } from '../common/utils/strings';
import { Industry, IndustryDocument } from '../industries/schemas/industry.schema';
import { Media, MediaDocument } from '../media/schemas/media.schema';
import { S3ObjectStorageService } from '../media/storage/s3-object-storage.service';

type IndustrySeed = {
  asset: string;
  name: string;
};

const INDUSTRIES: readonly IndustrySeed[] = [
  { name: 'Food', asset: 'food-bg.png' },
  { name: 'Coffee & Beverage', asset: 'cofee-bg.png' },
  { name: 'Tobacco & Cigarette', asset: 'jewelry-bg.png' },
  { name: 'Candle', asset: 'cosmetics-bg.png' },
  { name: 'Shampoo & Soap', asset: 'shampo-bg.png' },
  { name: 'Bakery', asset: 'bakery-bg.png' },
  { name: 'Gifting', asset: 'gifting-bg.png' },
  { name: 'Baby Products', asset: 'shampo-bg.png' },
  { name: 'Pharma', asset: 'shampo-bg.png' },
  { name: 'e-Commerce', asset: 'shampo-bg.png' },
  { name: 'Jewelry', asset: 'jewelry-bg.png' },
  { name: 'Luxury Retail', asset: 'cosmetics-bg.png' },
  { name: 'Restaurant', asset: 'food-bg.png' },
  { name: 'Tea & Beverage', asset: 'cofee-bg.png' },
  { name: 'Fashion & Apparel', asset: 'jewelry-bg.png' },
  { name: 'Personal Care', asset: 'cosmetics-bg.png' },
];

async function uploadAsset(
  assetName: string,
  assetsDirectory: string,
  media: Model<MediaDocument>,
  storage: S3ObjectStorageService,
): Promise<string> {
  const source = join(assetsDirectory, assetName);
  const key = `seed/industries/${assetName}`;
  const [body, metadata] = await Promise.all([readFile(source), stat(source)]);

  await storage.putObject(key, body, 'image/png');
  await media.findOneAndUpdate(
    { key },
    {
      $set: {
        originalName: assetName,
        mimeType: 'image/png',
        sizeBytes: metadata.size,
        status: 'ready',
        variants: {},
        deletedAt: null,
      },
      $setOnInsert: { uploadId: `seed-${assetName}` },
    },
    { upsert: true, returnDocument: 'after' },
  );

  return key;
}

async function seedIndustries(): Promise<void> {
  const assetsDirectory = resolve(
    process.argv[2] ?? '../custom-boxify-pro/public/bg/industries',
  );
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const industries = app.get<Model<IndustryDocument>>(
      getModelToken(Industry.name),
    );
    const media = app.get<Model<MediaDocument>>(getModelToken(Media.name));
    const storage = app.get(S3ObjectStorageService);
    const imageKeys = new Map<string, string>();

    for (const industry of INDUSTRIES) {
      let imageKey = imageKeys.get(industry.asset);
      if (!imageKey) {
        imageKey = await uploadAsset(industry.asset, assetsDirectory, media, storage);
        imageKeys.set(industry.asset, imageKey);
      }

      await industries.findOneAndUpdate(
        { slug: slugify(industry.name), deletedAt: null },
        {
          $set: {
            name: industry.name,
            description: `Custom packaging for ${industry.name}.`,
            bestFor: industry.name,
            specifications: ['Custom packaging'],
            imageKey,
            sortOrder: INDUSTRIES.indexOf(industry),
            isActive: true,
          },
          $setOnInsert: { slug: slugify(industry.name) },
        },
        { upsert: true, returnDocument: 'after' },
      );
    }

    process.stdout.write(`Seeded ${INDUSTRIES.length} industries.\n`);
  } finally {
    await app.close();
  }
}

void seedIndustries().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown seed error';
  process.stderr.write(`Industry seed failed: ${message}\n`);
  process.exitCode = 1;
});
