export const Permissions = {
  PRODUCTS_READ: 'products.read',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  PRODUCTS_RESTORE: 'products.restore',
  PRODUCTS_PUBLISH: 'products.publish',
  PRODUCTS_BULK_IMPORT: 'products.bulk-import',
  CATEGORIES_MANAGE: 'categories.manage',
  FILTERS_MANAGE: 'filters.manage',
  MEDIA_MANAGE: 'media.manage',
  REQUESTS_READ: 'requests.read',
  REQUESTS_UPDATE: 'requests.update',
  REQUESTS_ASSIGN: 'requests.assign',
  ADMINS_READ: 'admins.read',
  ADMINS_INVITE: 'admins.invite',
  ADMINS_UPDATE: 'admins.update',
  ROLES_MANAGE: 'roles.manage',
  AUDIT_LOGS_READ: 'audit-logs.read',
  SETTINGS_MANAGE: 'settings.manage',
  CHATS_READ: 'chats.read',
  CHATS_READ_ALL: 'chats.read_all',
  CHATS_REPLY: 'chats.reply',
  CHATS_ASSIGN: 'chats.assign',
  CHATS_MANAGE: 'chats.manage',
  CHATS_NOTES_CREATE: 'chats.notes.create',
  CHATS_TEMPLATES_SEND: 'chats.templates.send',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const ALL_PERMISSIONS: string[] = Object.values(Permissions);
