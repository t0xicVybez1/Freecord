import { useState, useRef, useCallback } from 'react';
import { Edit2, Trash2, Pin, Smile, Reply, MoreHorizontal, Check, X, GitBranch } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { ImageLightbox } from '../ui/ImageLightbox';
import { useAuthStore } from '../../stores/auth';
import { useMessagesStore } from '../../stores/messages';
import { useUIStore } from '../../stores/ui';
import { useChannelsStore } from '../../stores/channels';
import { useGuildsStore } from '../../stores/guilds';
import { api } from '../../lib/api';
import { renderMarkdown } from '@freecord/markdown';
import { formatMessageDate, formatTime } from '../../lib/utils';
import type { Message } from '@freecord/types';
import { MessageType } from '@freecord/types';

interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
  onReply: (message: Message) => void;
}

const REACTIONS_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function SystemMessage({ message }: { message: Message }) {
  const authorName = message.author?.displayName || message.author?.username || 'Someone';
  let text = '';
  let icon = '•';

  switch (message.type) {
    case MessageType.GUILD_MEMBER_JOIN:
      icon = '👋'; text = `${authorName} joined the server. Welcome!`; break;
    case MessageType.CHANNEL_PINNED_MESSAGE:
      icon = '📌'; text = `${authorName} pinned a message to this channel.`; break;
    case MessageType.RECIPIENT_ADD:
      icon = '➕'; text = `${authorName} was added to the group.`; break;
    case MessageType.RECIPIENT_REMOVE:
      icon = '➖'; text = `${authorName} left the group.`; break;
    case MessageType.CALL:
      icon = '📞'; text = `${authorName} started a call.`; break;
    case MessageType.CHANNEL_NAME_CHANGE:
      icon = '✏️'; text = `${authorName} changed the channel name: ${message.content}`; break;
    case MessageType.CHANNEL_ICON_CHANGE:
      icon = '🖼️'; text = `${authorName} changed the channel icon.`; break;
    case MessageType.THREAD_CREATED:
      icon = '🧵'; text = `${authorName} started a thread: ${message.content}`; break;
    default:
      text = message.content;
  }

  return (
    <div className="system-message group relative">
      <span className="flex-shrink-0">{icon}</span>
      <span>{text}</span>
      <span className="text-[10px] text-text-muted ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {formatTime(new Date(message.createdAt))}
      </span>
    </div>
  );
}

export function MessageItem({ message, isGrouped, onReply }: MessageItemProps) {
  const { user } = useAuthStore();
  const { updateMessage, removeMessage } = useMessagesStore();
  const { openContextMenu } = useUIStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<{ src: string; filename: string } | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const channel = useChannelsStore(s => s.getChannel(message.channelId));
  const guild = useGuildsStore(s => channel?.guildId ? s.getGuild(channel.guildId) : undefined);

  const isOwn = user?.id === message.author?.id;
  const isGuildOwner = !!guild && guild.ownerId === user?.id;
  const canEdit = isOwn && message.type === MessageType.DEFAULT;
  const canDelete = isOwn || isGuildOwner;
  const isSystem = message.type !== MessageType.DEFAULT && message.type !== MessageType.REPLY;

  const handleEdit = useCallback(async () => {
    if (!editContent.trim() || editContent === message.content) {
      setIsEditing(false); setEditContent(message.content); return;
    }
    try {
      const updated = await api.patch<Message>(
        `/api/v1/channels/${message.channelId}/messages/${message.id}`,
        { content: editContent.trim() }
      );
      updateMessage(message.channelId, updated.id, updated);
      setIsEditing(false);
    } catch { setEditContent(message.content); }
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

  const handleCreateThread = useCallback(async () => {
    try {
      await api.post(`/api/v1/channels/${message.channelId}/messages/${message.id}/threads`, {
        name: `Thread`,
        autoArchiveDuration: 1440,
      });
    } catch {}
  }, [message]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('spoiler')) {
      target.classList.toggle('revealed');
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const items = [
      ...(canEdit ? [{ label: 'Edit Message', icon: <Edit2 size={14} />, onClick: () => { setIsEditing(true); setTimeout(() => editRef.current?.focus(), 50); } }] : []),
      { label: 'Reply', icon: <Reply size={14} />, onClick: () => onReply(message) },
      { label: 'Pin Message', icon: <Pin size={14} />, onClick: async () => { try { await api.put(`/api/v1/channels/${message.channelId}/pins/${message.id}`, {}); } catch {} } },
      ...(channel?.guildId ? [{ label: 'Create Thread', icon: <GitBranch size={14} />, onClick: handleCreateThread }] : []),
      { label: '', onClick: () => {}, divider: true },
      { label: 'Copy Message ID', onClick: () => navigator.clipboard.writeText(message.id) },
      ...(canDelete ? [{ label: 'Delete Message', icon: <Trash2 size={14} />, danger: true, onClick: handleDelete }] : []),
    ];
    openContextMenu(e.clientX, e.clientY, items);
  }, [canEdit, canDelete, message, onReply, handleDelete, handleCreateThread, openContextMenu, channel]);

  const renderedContent = renderMarkdown(message.content);

  if (isSystem) return <SystemMessage message={message} />;

  return (
    <>
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc.src} filename={lightboxSrc.filename} onClose={() => setLightboxSrc(null)} />
      )}
      <div
        className={`group relative flex gap-4 px-4 py-0.5 hover:bg-black/10 ${!isGrouped ? 'mt-4 pt-2' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setShowEmojiBar(false); }}
        onContextMenu={handleContextMenu}
      >
        {/* Avatar or time */}
        <div className="w-10 flex-shrink-0">
          {!isGrouped ? (
            <Avatar userId={message.author?.id || ''} username={message.author?.username || 'Unknown'} avatarHash={message.author?.avatar} size={40} />
          ) : (
            <span className="text-[10px] text-text-muted leading-[1.375rem] opacity-0 group-hover:opacity-100 select-none">
              {formatTime(new Date(message.createdAt))}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {!isGrouped && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="font-medium text-text-header hover:underline cursor-pointer text-sm">
                {message.author?.displayName || message.author?.username || 'Unknown'}
              </span>
              {message.author?.bot && (
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
              <span className="font-medium text-text-link">
                {message.referencedMessage.author?.displayName || message.referencedMessage.author?.username || 'Unknown'}
              </span>
              <span className="truncate">{message.referencedMessage.content}</span>
            </div>
          )}

          {/* Message text */}
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
                <button onClick={handleEdit} className="text-brand hover:underline flex items-center gap-1"><Check size={12} /> Save</button>
                <span>•</span>
                <button onClick={() => { setIsEditing(false); setEditContent(message.content); }} className="hover:underline flex items-center gap-1"><X size={12} /> Cancel</button>
                <span className="ml-auto">Esc to cancel • Enter to save</span>
              </div>
            </div>
          ) : (
            <div
              className="message-content text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
              onClick={handleContentClick}
            />
          )}

          {/* Edited tag */}
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
                      src={att.url} alt={att.filename}
                      className="rounded max-w-xs max-h-80 object-contain cursor-zoom-in hover:brightness-90 transition-all"
                      loading="lazy"
                      onClick={() => setLightboxSrc({ src: att.url, filename: att.filename })}
                    />
                  ) : att.contentType?.startsWith('video/') ? (
                    <video src={att.url} controls className="rounded max-w-sm max-h-60" preload="metadata" />
                  ) : (
                    <a href={att.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded text-sm text-brand hover:underline">
                      📎 {att.filename}
                      <span className="text-text-muted text-xs">({Math.round(att.size / 1024)}KB)</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Embeds */}
          {message.embeds && message.embeds.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {message.embeds.map((embed, i) => (
                <div key={i} className="flex gap-0.5 max-w-lg"
                  style={{ borderLeft: `4px solid ${embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#4f545c'}` }}>
                  <div className="flex-1 bg-bg-secondary rounded-r px-3 py-2">
                    {embed.author?.name && <p className="text-xs text-text-muted mb-1 font-medium">{embed.author.name}</p>}
                    {embed.title && (
                      <p className="text-sm font-semibold text-text-header">
                        {embed.url ? <a href={embed.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-text-link">{embed.title}</a> : embed.title}
                      </p>
                    )}
                    {embed.description && <p className="text-sm text-text-muted mt-1 line-clamp-6">{embed.description}</p>}
                    {embed.fields && embed.fields.length > 0 && (
                      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                        {embed.fields.map((f, fi) => (
                          <div key={fi}>
                            <p className="text-xs font-semibold text-text-header">{f.name}</p>
                            <p className="text-xs text-text-muted">{f.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {embed.image?.url && (
                      <img src={embed.image.url} alt="" className="mt-2 rounded max-w-full max-h-60 object-contain cursor-zoom-in"
                        onClick={() => setLightboxSrc({ src: embed.image!.url, filename: 'image' })} />
                    )}
                    {embed.footer?.text && <p className="text-[10px] text-text-muted mt-2">{embed.footer.text}</p>}
                  </div>
                  {embed.thumbnail?.url && (
                    <img src={embed.thumbnail.url} alt="" className="w-20 h-20 object-cover rounded-r flex-shrink-0 cursor-zoom-in"
                      onClick={() => setLightboxSrc({ src: embed.thumbnail!.url, filename: 'thumbnail' })} />
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
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors ${
                    reaction.me ? 'bg-brand/20 border-brand/50 text-brand' : 'bg-bg-secondary border-[#1e1f22] hover:bg-bg-primary'
                  }`}
                >
                  {reaction.emoji.animated
                    ? <img src={`https://cdn.discordapp.com/emojis/${reaction.emoji.id}.gif`} alt={reaction.emoji.name || ''} className="w-4 h-4" />
                    : <span>{reaction.emoji.name}</span>}
                  <span className="text-text-header">{reaction.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hover action bar */}
        {isHovered && !isEditing && (
          <div className="absolute right-4 top-0 -translate-y-1/2 flex items-center bg-bg-secondary border border-[#1e1f22] rounded shadow-lg z-10">
            <div className="flex">
              {REACTIONS_EMOJI.slice(0, 3).map(emoji => (
                <Tooltip key={emoji} content={emoji} side="top">
                  <button onClick={() => handleReact(emoji)} className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-sm transition-colors">{emoji}</button>
                </Tooltip>
              ))}
            </div>
            <div className="w-px h-5 bg-[#1e1f22] mx-0.5" />
            <Tooltip content="Add Reaction" side="top">
              <button onClick={() => setShowEmojiBar(v => !v)} className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-text-muted hover:text-text-header transition-colors">
                <Smile size={16} />
              </button>
            </Tooltip>
            <Tooltip content="Reply" side="top">
              <button onClick={() => onReply(message)} className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-text-muted hover:text-text-header transition-colors">
                <Reply size={16} />
              </button>
            </Tooltip>
            {canEdit && (
              <Tooltip content="Edit" side="top">
                <button onClick={() => { setIsEditing(true); setTimeout(() => editRef.current?.focus(), 50); }} className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-text-muted hover:text-text-header transition-colors">
                  <Edit2 size={16} />
                </button>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip content="Delete" side="top">
                <button onClick={handleDelete} className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-text-muted hover:text-danger transition-colors">
                  <Trash2 size={16} />
                </button>
              </Tooltip>
            )}
            <Tooltip content="More" side="top">
              <button onContextMenu={e => e.preventDefault()} onClick={handleContextMenu as any} className="w-8 h-8 flex items-center justify-center hover:bg-bg-primary rounded text-text-muted hover:text-text-header transition-colors">
                <MoreHorizontal size={16} />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </>
  );
}
