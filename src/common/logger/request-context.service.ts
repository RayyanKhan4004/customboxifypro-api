import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export interface RequestContextData {
  requestId: string;
  adminId?: string;
  ip?: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextData>();

  run<T>(data: RequestContextData, callback: () => T): T {
    return this.storage.run(data, callback);
  }

  current(): RequestContextData | undefined {
    return this.storage.getStore();
  }

  updateCurrent(partial: Partial<RequestContextData>): void {
    const store = this.storage.getStore();
    if (store) {
      Object.assign(store, partial);
    }
  }

  requestId(): string {
    return this.current()?.requestId ?? 'no-request-id';
  }

  adminId(): string | undefined {
    return this.current()?.adminId;
  }
}
