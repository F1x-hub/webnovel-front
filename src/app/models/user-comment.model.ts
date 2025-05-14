export interface UserComment {
  id: number;
  userId: number;
  targetUserId: number;
  username: string;
  displayName?: string; // For backwards compatibility
  userAvatar?: string;
  content: string;
  createdAt: string;
  publishedDate?: string; // For backwards compatibility
  likesCount: number;
  likes?: number; // For backwards compatibility
  isLikedByCurrentUser?: boolean;
  showOptions?: boolean;
  [key: string]: any; // For dynamic property access
} 