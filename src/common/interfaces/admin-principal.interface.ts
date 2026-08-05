export interface AdminPrincipal {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleKey: string;
  permissions: string[];
  sessionId?: string;
}
