/** Media key -> public URL plus variant URLs (used by product responses). */
export interface MediaUrlMap {
  [key: string]: { url: string; variants: Record<string, string> };
}

export interface ObjectStorage {
  createPresignedUpload(
    key: string,
    contentType: string,
    contentLength: number,
  ): Promise<{ url: string; method: 'PUT' }>;
  headObject(
    key: string,
  ): Promise<{ size: number; contentType: string } | null>;
  getObject(key: string): Promise<Buffer>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
}
