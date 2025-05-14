export interface NovelComment {
  id: number;
  novelId: number;
  userId: number;
  username: string;
  displayName?: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  publishedDate?: string;
  likesCount: number;
  likes?: number;
  isLikedByCurrentUser?: boolean;
  showOptions?: boolean;
  [key: string]: any;
} 