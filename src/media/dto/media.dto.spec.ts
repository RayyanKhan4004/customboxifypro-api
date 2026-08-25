import 'reflect-metadata';
import { validate } from 'class-validator';

import { PresignMediaDto, UpdateMediaDto } from './media.dto';

describe('media DTO validation', () => {
  it('accepts a valid image presign payload', async () => {
    const dto = Object.assign(new PresignMediaDto(), {
      fileName: 'dice-6.png',
      mimeType: 'image/png',
      sizeBytes: 5357,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects filenames longer than 255 characters', async () => {
    const dto = Object.assign(new PresignMediaDto(), {
      fileName: `${'a'.repeat(252)}.png`,
      mimeType: 'image/png',
      sizeBytes: 5357,
    });

    const errors = await validate(dto);

    expect(errors[0]?.constraints).toHaveProperty('maxLength');
  });

  it('accepts string alt text within the 500-character limit', async () => {
    const dto = Object.assign(new UpdateMediaDto(), {
      alt: 'Product packaging shown from the front.',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
