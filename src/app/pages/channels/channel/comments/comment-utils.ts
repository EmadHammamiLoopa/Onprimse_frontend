// src/app/utils/comment-utils.ts
import { Comment } from '../../../../../app/models/Comment';

export function getCommentUserName(comment: Comment): string {
  return comment.anonymName || `${comment.user.firstName} ${comment.user.lastName}`;
}
