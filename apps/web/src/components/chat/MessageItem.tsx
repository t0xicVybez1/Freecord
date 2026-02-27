import { useState, useRef, useCallback } from 'react';
import { Edit2, Trash2, Pin, Smile, Reply, MoreHorizontal, Check, X } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { useAuthStore } from '../../stores/auth';
import { useMessagesStore } from '../../stores/messages';
import { useUIStore } from '../../stores/ui';
import { api } from '../../lib/api';
import { renderMarkdown } from '@freecord/markdown';
import { formatMessageDate, formatTime } from '../../lib/utils';
import type { Message } from '@freecord/types';
import { MessageType } from '@freecord/types';

interface MessageItemProps {
  message: Message;
  isGrouped: boolean; // same author within 7 minutes
  onReply: (message: Message) => void;
}

const REACTIONS_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export function MessageItem({ message, isGrouped, onReply }: MessageItemProps) {
  const { user } = useAuthStore();
  const { updateMessage, removeMessage } = useMessagesStore();
  const { openContextMenu } = useUIStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isOwn = user?.id === message.author?.id;
  const canEdit = isOwn && message.type === MessageType.DEFAULT;
  const canDelete = isOwn; // simplified; admins can delete too

  const handleEdit = useCallback(async () => {
    if (!editContent.trim() || editContent === message.content) {
      setIsEditing(false);
      setEditContent(message.content);
      return;
    }
    try {
      const updated = await api.patch<Message>(
        `/api/v1/channels/${message.channelId}/messages/${message.id}`,
        { content: editContent.trim() }
      );
      updateMessage(message.channelId, updated.id, updated);
      setIsEditing(false);
    } catch {
      // revert on error
      setEditContent(message.content);
    }
  }, [editContent, message, updateMessage]);

  const handleDelete = useCallback(async () => {
    try {
      await api.delete(`/api/v1/channels/${message.channelId}/messages/${message.id}`);
      removeMessage(message.channelId, message.id);
    } catch {}
  }, [message, removeMessage]);

  const handleReact = useCallback(async (emoji: string) => {
    try {
      await api.put(`/api/v1/channels/${message.channelId}/messages/${message.id}/reactions/${encodeURIComponent(emoji)}/@me`, {});
    } catch {}
    setShowEmojiBar(false);
  }, [message]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const items = [
      ...(canEdit ? [{ label: 'Edit Message', icon: <Edit2 size={14} />, onClick: () => { setIsEditing(true); setTimeout(() => editRef.current?.focus(), 50); } }] : []),
      { label: 'Reply', icon: <Reply size={14} />, onClick: () => onReply(message) },
      { label: 'Pin Message', icon: <Pin size={14} />, onClick: async () => { await api.put(`/api/v1/channels/${message.channelId}/pins/${message.id}`, {}); } },
      { label: '', onClick: () => {}, divider: true },
      { label: 'Copy Message ID', onClick: () => navigator.clipboard.writeText(message.id) },
      ...(canDelete ? [{ label: 'Delete Message', icon: <Trash2 size={14} />, danger: true, onClick: handleDelete }] : []),
    ];
    openContextMenu(e.clientX, e.clientY, items);
  }, [canEdit, canDelete, message, onReply, handleDelete, openContextMenu]);

  const renderedContent = renderMarkdown(message.content);

  return (
    <div
      className={`group relative flex gap-4 px-4 py-0.5 hover:bg-black/10 ${!isGrouped ? 'mt-4 pt-2' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowEmojiBar(false); }}
      onContextMenu={handleContextMenu}
    >
      {/* Avatar or timestamp column */}
      <div className="w-10 flex-shrink-0">
        {!isGrouped ? (
          <Avatar userId={message.author.id} username={message.author.username} avatarHash={message.author.avatar} size={40} />
        ) : (
          <span className={`text-[10px] text-text-muted leading-[1.375rem] opacity-0 group-hover:opacity-100 select-none`}>
            {formatTime(new Date(message.createdAt))}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-medium text-text-header hover:underline cursor-pointer text-sm">
              {message.author.displayName || message.author.username}
            </span>
            {message.author.bot && (
              <span className="px-1 py-0.5 text-[10px] font-bold bg-brand text-white rounded uppercase leading-none">BOT</span>
            )}
            <span className="text-xs text-text-muted">{formatMessageDate(new Date(message.createdAt))}</span>
          </div>
        )}

        {/* Reply reference */}
        {message.referencedMessage && (
          <div className="flex items-center gap-2 text-xs text-text-muted mb-1 ml-4 cursor-pointer hover:text-text-header">
            <Reply size={12} className="rotate-180 flex-shrink-0" />
            <Avatar userId={message.referencedMessage.author?.id || ''} username={message.referencedMessage.author?.username || 'Unknown'} avatarHash={message.referencedMessage.author?.avatar} size={16} />
            <span className="font-medium text-text-interactive">
              {message.referencedMessage.author.displayName || message.referencedMessage.author.username}
            </span>
            <span className="truncate">{message.referencedMessage.content}</span>
          </div>
        )}

        {/* Message content */}
        {isEditing ? (
          <div className="mt-1">
            <textarea
              ref={editRef}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                if (e.key === 'Escape') { setIsEditing(false); setEditContent(message.content); }
              }}
              className="w-full bg-bg-tertiary text-text-header rounded px-3 py-2 text-sm resize-none outline-none focus:ring-2 ring-brand"
              rows={Math.min(10, editContent.split('\n').length + 1)}
            />
            <div className="flex gap-2 mt-1 text-xs text-text-muted">
              <button onClick={handleEdit} className="text-brand hover:underline flex items-center gap-1">
                <Check size={12} /> Save
              </button>
              <span>•</span>
              <button onClick={() => { setIsEditing(false); setEditContent(message.content); }} className="hover:underline flex items-center gap-1">
                <X size={12} /> Cancel
              </button>
              <span className="ml-auto">Esc to cancel • Enter to save</span>
            </div>
          </div>
        ) : (
          <div
            className="message-content text-sm text-text-header leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        )}

        {/* Edited indicator */}
        {message.editedAt && !isEditing && (
          <span className="text-[10px] text-text-muted ml-1">(edited)</span>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map(att => (
              <div key={att.id}>
                {att.contentType?.startsWith('image/') ? (
                  <img
                    src={att.url}
                    alt={att.filename}
                    className="rounded max-w-xs max-h-80 object-contain cursor-zoom-in"
                    loading="lazy"
                  />
                ) : (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded text-sm text-brand hover:underline"
                  >
                    📎 {att.filename}
                    <span className="text-text-muted text-xs">({Math.round(att.size / 1024)}KB)</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.reactions.map(reaction => (
              <button
                key={`${reaction.emoji.name}-${reaction.emoji.id || ''}`}
                onClick={() => handleReact(reaction.emoji.name || '')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors
                  ${reaction.me
                    ? 'bg-brand/20 border-brand/50 text-brand'
                    : 'bg-bg-secondary border-border hover:bg-bg-primary border-[#1e1f22]'
                  }`}
              >
                {reaction.emoji.animated
                  ? <img src={`https://cdn.discordapp.com/emojis/${reaction.emoji.id}.gif`} alt={reaction.emoji.name || ''} className="w-4 h-4" />
                  : <span>{reaction.emoji.name}</span>
                }
                <span className="text-text-header">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover action bar */}
      {isHovered && !isEditing && (
        <div className="absolute right-4 top-0 -translate-y-1/2 flex items-center bg-bg-secondary border border-[#1e1f22] rounded shadow-lg z-10">
          {/* Quick emoji reactions */}
          <div className="flex">
            {REACTIONS_EMOJI.slice(0, 3).map(emoji => (
              <Tooltip key={emoji} content={emoji} side="top">
                <button
                  onClick={() => handleReact(emoji)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-sm transition-colors"
                >
                  {emoji}
                </button>
              </Tooltip>
            ))}
          </div>
          <div className="w-px h-5 bg-[#1e1f22] mx-0.5" />
          <Tooltip content="Add Reaction" side="top">
            <button
              onClick={() => setShowEmojiBar(v => !v)}
              className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-text-muted hover:text-text-header transition-colors"
            >
              <Smile size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Reply" side="top">
            <button
              onClick={() => onReply(message)}
              className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-text-muted hover:text-text-header transition-colors"
            >
              <Reply size={16} />
            </button>
          </Tooltip>
          {canEdit && (
            <Tooltip content="Edit" side="top">
              <button
                onClick={() => { setIsEditing(true); setTimeout(() => editRef.current?.focus(), 50); }}
                className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-text-muted hover:text-text-header transition-colors"
              >
                <Edit2 size={16} />
              </button>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip content="Delete" side="top">
              <button
                onClick={handleDelete}
                className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-text-muted hover:text-danger transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </Tooltip>
          )}
          <Tooltip content="More" side="top">
            <button
              onContextMenu={e => { e.preventDefault(); }}
              className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-text-muted hover:text-text-header transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
