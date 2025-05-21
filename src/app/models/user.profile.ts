export interface UserProfile {
  id: number;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  roleId: number;
  roleName?: string;
  imageUrl?: string;
  memberSince?: Date;
  createdAt?: string;
  hasNewChapters?: boolean;
} 