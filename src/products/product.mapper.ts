import { MediaUrlMap } from '../media/storage/object-storage.interface';
import { ProductDocument } from './schemas/product.schema';

export interface ProductImageResponse {
  key: string;
  url: string;
  variants: Record<string, string>;
  alt: string;
  isMain: boolean;
}

export interface ProductListItemResponse {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  categoryId: string;
  subcategoryId: string | null;
  status: string;
  visibility: string;
  featured: boolean;
  tags: string[];
  sku: string | null;
  image: ProductImageResponse | null;
  publishedAt: Date | null;
  updatedAt: Date;
  version: number;
}

export interface ProductDetailResponse extends ProductListItemResponse {
  description: string;
  images: ProductImageResponse[];
  attributes: Record<string, unknown>;
  dimensions: Record<string, unknown>;
  moq: number | null;
  customizableProperties: unknown;
  seo: Record<string, unknown>;
  createdAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

function imageUrl(key: string, urls: MediaUrlMap): ProductImageResponse {
  const resolved = urls[key];
  return {
    key,
    url: resolved?.url ?? `/${key}`,
    variants: resolved?.variants ?? {},
    alt: '',
    isMain: false,
  };
}

export function toListItem(
  product: ProductDocument,
  urls: MediaUrlMap,
): ProductListItemResponse {
  const images = product.images ?? [];
  const main = images.find((i) => i.isMain) ?? images[0] ?? null;
  return {
    id: product._id.toString(),
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription ?? '',
    categoryId: product.categoryId.toString(),
    subcategoryId: product.subcategoryId
      ? product.subcategoryId.toString()
      : null,
    status: product.status,
    visibility: product.visibility,
    featured: product.featured ?? false,
    tags: product.tags ?? [],
    sku: product.sku ?? null,
    image: main
      ? {
          ...imageUrl(main.key, urls),
          alt: main.alt ?? '',
          isMain: main.isMain ?? false,
        }
      : null,
    publishedAt: product.publishedAt ?? null,
    updatedAt: product.updatedAt,
    version: product.version ?? 1,
  };
}

export function toDetail(
  product: ProductDocument,
  urls: MediaUrlMap,
): ProductDetailResponse {
  const images = product.images ?? [];
  return {
    ...toListItem(product, urls),
    description: product.description ?? '',
    images: images.map((image) => ({
      ...imageUrl(image.key, urls),
      alt: image.alt ?? '',
      isMain: image.isMain ?? false,
    })),
    attributes: product.attributes
      ? Object.fromEntries(product.attributes)
      : {},
    dimensions: (product.dimensions ?? {}) as Record<string, unknown>,
    moq: product.moq ?? null,
    customizableProperties: product.customizableProperties ?? null,
    seo: (product.seo ?? {}) as Record<string, unknown>,
    createdAt: product.createdAt,
    createdBy: product.createdBy ? product.createdBy.toString() : null,
    updatedBy: product.updatedBy ? product.updatedBy.toString() : null,
  };
}
