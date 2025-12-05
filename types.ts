export enum KeyStatus {
  VALID = 'VALID',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  id: string;
  username: string;
  password: string; // Plaintext for demo purposes
  role: UserRole;
}

export interface LicenseKey {
  id: string;
  key: string;
  status: KeyStatus;
  createdAt: string;
  activatedAt?: string;
  expiresAt?: string;
  plan: 'Standard' | 'Pro' | 'Enterprise';
  owner?: string; // User ID
}

export interface AnalyticsSummary {
  totalKeys: number;
  activeKeys: number;
  revenue: number;
  aiInsight: string;
}