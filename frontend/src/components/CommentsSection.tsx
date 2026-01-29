/**
 * CommentsSection - Reusable comment thread component
 *
 * Can be embedded in any entity view (tasks, deadlines, documents, etc.)
 * Supports @mentions with user autocomplete.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageCircle,
  Send,
  Edit2,
  Trash2,
  MoreVertical,
  AtSign,
  X,
} from 'lucide-react';
import {
  getEntityComments,
  createEntityComment,
  updateEntityComment,
  deleteEntityComment,
  searchUsersForMention,
  type Comment,
  type UserBrief,
} from '../lib/api';

interface CommentsSectionProps {
  entityType: string;
  entityId: number;
  className?: string;
  collapsible?: boolean;
  maxHeight?: string;
}

export default function CommentsSection({
  entityType,
  entityId,
  className = '',
  collapsible = false,
  maxHeight = '400px',
}: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showMenu, setShowMenu] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(collapsible);

  // @mention autocomplete state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionUsers, setMentionUsers] = useState<UserBrief[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEntityComments(entityType, entityId);
      setComments(data);
    } catch {
      // Error is handled by global error handler
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Search for users when @mention is triggered
  useEffect(() => {
    if (mentionQuery.length > 0) {
      const searchUsers = async () => {
        try {
          const users = await searchUsersForMention(mentionQuery);
          setMentionUsers(users);
          setMentionIndex(0);
        } catch {
          setMentionUsers([]);
        }
      };
      const timeout = setTimeout(searchUsers, 200);
      return () => clearTimeout(timeout);
    } else {
      setMentionUsers([]);
    }
  }, [mentionQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);

    // Check for @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowMentions(true);
      setMentionQuery(mentionMatch[1]);
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  };

  const insertMention = (user: UserBrief) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = newComment.substring(0, cursorPos);
    const textAfterCursor = newComment.substring(cursorPos);

    // Replace the @query with @"Name"
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const beforeMention = textBeforeCursor.substring(0, textBeforeCursor.length - mentionMatch[0].length);
      const mention = user.name ? `@"${user.name}" ` : `@${user.email.split('@')[0]} `;
      setNewComment(beforeMention + mention + textAfterCursor);
    }

    setShowMentions(false);
    setMentionQuery('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionUsers.length) % mentionUsers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionUsers[mentionIndex]);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;

    try {
      setSubmitting(true);
      await createEntityComment({
        entity_type: entityType,
        entity_id: entityId,
        content: newComment.trim(),
      });
      setNewComment('');
      await loadComments();
    } catch {
      // Error handled by global handler
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (id: number) => {
    if (!editContent.trim() || submitting) return;

    try {
      setSubmitting(true);
      await updateEntityComment(id, editContent.trim());
      setEditingId(null);
      setEditContent('');
      await loadComments();
    } catch {
      // Error handled by global handler
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      await deleteEntityComment(id);
      await loadComments();
    } catch {
      // Error handled by global handler
    }
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
    setShowMenu(null);
  };

  if (collapsible && isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className={`flex items-center gap-2 text-sm text-gray-400 hover:text-cyan-400 transition-colors ${className}`}
      >
        <MessageCircle className="w-4 h-4" />
        <span>
          {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </span>
      </button>
    );
  }

  return (
    <div className={`bg-[#1a1d24]/5 rounded-lg border border-white/10 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <MessageCircle className="w-4 h-4 text-cyan-400" />
          <span>Comments ({comments.length})</span>
        </div>
        {collapsible && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 text-gray-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Comments List */}
      <div
        className="overflow-y-auto p-3 space-y-3"
        style={{ maxHeight }}
      >
        {loading ? (
          <div className="text-center text-gray-500 py-4">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="group p-3 rounded-lg bg-[#1a1d24]/5 hover:bg-[#1a1d24]/10 transition-colors"
            >
              {editingId === comment.id ? (
                // Edit mode
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-black/20 border border-white/20 rounded-lg p-2 text-sm text-white resize-none focus:outline-none focus:border-cyan-500"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(comment.id)}
                      disabled={submitting}
                      className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditContent('');
                      }}
                      className="px-3 py-1 text-xs bg-gray-600 hover:bg-white/50 text-white rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">
                        {(comment.user?.name || comment.user?.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-white">
                          {comment.user?.name || comment.user?.email}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                        {comment.is_edited && (
                          <span className="text-xs text-gray-400 ml-1">(edited)</span>
                        )}
                      </div>
                    </div>

                    {/* Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setShowMenu(showMenu === comment.id ? null : comment.id)}
                        className="p-1 text-gray-500 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {showMenu === comment.id && (
                        <div className="absolute right-0 top-6 z-50 bg-gray-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[100px]">
                          <button
                            onClick={() => startEdit(comment)}
                            className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-[#1a1d24]/10 flex items-center gap-2"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-[#1a1d24]/10 flex items-center gap-2"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <p className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">
                    {comment.content}
                  </p>

                  {/* Mentions */}
                  {comment.mentioned_users && comment.mentioned_users.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {comment.mentioned_users.map((user) => (
                        <span
                          key={user.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-900/30 text-cyan-400 text-xs rounded-full"
                        >
                          <AtSign className="w-3 h-3" />
                          {user.name || user.email}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Comment Input */}
      <div className="p-3 border-t border-white/10">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={newComment}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment... (@ to mention)"
            className="w-full bg-black/20 border border-white/20 rounded-lg p-3 pr-12 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500"
            rows={2}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="absolute right-2 bottom-2 p-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>

          {/* @mention autocomplete dropdown */}
          {showMentions && mentionUsers.length > 0 && (
            <div className="absolute left-0 bottom-full mb-1 w-64 bg-gray-800 border border-white/10 rounded-lg shadow-xl py-1 z-20">
              {mentionUsers.map((user, index) => (
                <button
                  key={user.id}
                  onClick={() => insertMention(user)}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2 ${
                    index === mentionIndex ? 'bg-cyan-600/20' : 'hover:bg-[#1a1d24]/5'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">
                    {(user.name || user.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">
                      {user.name || user.email}
                    </div>
                    {user.name && (
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Press <kbd className="px-1 py-0.5 bg-[#1a1d24]/10 rounded text-gray-400">{navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter</kbd> to send
        </p>
      </div>
    </div>
  );
}
