import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Gift, Sticker, Smile } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { Avatar } from '../ui/Avatar';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useMessagesStore } from '../../stores/messages';
import { useGuildsStore } from '../../stores/guilds';
import { useChannelsStore } from '../../stores/channels';
import { gateway } from '../../lib/gateway';
import type { Message } from '@freecord/types';

// Detect @mention or #channel query before cursor
function getMentionQuery(text: string, cursor: number): { type: '@' | '#'; query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = before.match(/(?:^|\s)(@|#)(\w*)$/);
  if (!match) return null;
  const start = before.lastIndexOf(match[1]);
  return { type: match[1] as '@' | '#', query: match[2].toLowerCase(), start };
}

interface MessageInputProps {
  channelId: string;
  channelName: string;
  replyTo?: Message | null;
  onClearReply?: () => void;
  disabled?: boolean;
}

const MAX_LENGTH = 2000;

export function MessageInput({
  channelId,
  channelName,
  replyTo,
  onClearReply,
  disabled = false,
}: MessageInputProps) {
  const { user } = useAuthStore();
  const { addMessage } = useMessagesStore();
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [mentionState, setMentionState] = useState<{
    type: '@' | '#'; query: string; start: number; selectedIdx: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Guild context for autocomplete
  const channel = useChannelsStore(s => s.getChannel(channelId));
  const guild = useGuildsStore(s => channel?.guildId ? s.guilds[channel.guildId] : undefined);
  const guildChannels = useChannelsStore(s => channel?.guildId ? s.getGuildChannels(channel.guildId) : []);

  // Build mention candidates
  const mentionCandidates = (() => {
    if (!mentionState) return [] as any[];
    const q = mentionState.query;
    if (mentionState.type === '@') {
      const members = (guild?.members || []).filter(m =>
        (m.nickname || m.user.username).toLowerCase().includes(q)
      ).slice(0, 8).map(m => ({
        id: m.user.id, label: m.nickname || m.user.username,
        sublabel: m.nickname ? m.user.username : undefined,
        avatar: m.user.avatar, isRole: false, insert: `<@${m.user.id}>`,
      }));
      const roles = (guild?.roles || []).filter(r =>
        r.name !== '@everyone' && r.name.toLowerCase().includes(q)
      ).slice(0, 4).map(r => ({
        id: r.id, label: `@${r.name}`, sublabel: 'Role',
        avatar: null, isRole: true, color: r.color, insert: `<@&${r.id}>`,
      }));
      return [...members, ...roles];
    } else {
      return guildChannels.filter(c => c.name && c.name.toLowerCase().includes(q)).slice(0, 8).map(c => ({
        id: c.id, label: `#${c.name}`, sublabel: undefined,
        avatar: null, isRole: false, isChannel: true, insert: `<#${c.id}>`,
      }));
    }
  })();

  const colorToHex = (c: number) => c ? `#${c.toString(16).padStart(6, '0')}` : '#99aab5';

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 300) + 'px';
  }, [content]);

  const sendTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      api.post(`/api/v1/channels/${channelId}/typing`, {}).catch(() => {});
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 9000);
  }, [channelId]);

  const insertMention = useCallback((candidate: (typeof mentionCandidates)[0]) => {
    if (!mentionState) return;
    const before = content.slice(0, mentionState.start);
    const after = content.slice(textareaRef.current?.selectionEnd ?? content.length);
    const newContent = before + candidate.insert + ' ' + after;
    setContent(newContent);
    setMentionState(null);
    setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = (before + candidate.insert + ' ').length;
      el.focus(); el.setSelectionRange(pos, pos);
    }, 0);
  }, [content, mentionState]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState && mentionCandidates.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionState(s => s ? { ...s, selectedIdx: (s.selectedIdx - 1 + mentionCandidates.length) % mentionCandidates.length } : null);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionState(s => s ? { ...s, selectedIdx: (s.selectedIdx + 1) % mentionCandidates.length } : null);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertMention(mentionCandidates[mentionState.selectedIdx]);
        return;
      }
      if (e.key === 'Escape') { setMentionState(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [content, channelId, replyTo, mentionState, mentionCandidates, insertMention]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    if (val) sendTyping();
    const cursor = e.target.selectionStart ?? val.length;
    const result = getMentionQuery(val, cursor);
    if (result) {
      setMentionState(s => ({ ...result, selectedIdx: s?.start === result.start ? s.selectedIdx : 0 }));
    } else {
      setMentionState(null);
    }
  }, [sendTyping]);

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;
    setContent('');
    setMentionState(null);
    isTypingRef.current = false;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    try {
      const msg = await api.post<Message>(`/api/v1/channels/${channelId}/messages`, {
        content: trimmed,
        ...(replyTo ? { messageReference: { messageId: replyTo.id } } : {}),
      });
      addMessage(channelId, msg);
      onClearReply?.();
    } catch (err) {
      // restore content on failure
      setContent(trimmed);
    }
  }, [content, disabled, channelId, replyTo, addMessage, onClearReply]);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('files', f));
      // Upload via CDN first, then send message with attachment URLs
      // For now, send as multipart to the API
      const msg = await api.upload<Message>(`/api/v1/channels/${channelId}/messages`, formData);
      addMessage(channelId, msg);
    } catch {}
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [channelId, addMessage]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const remaining = MAX_LENGTH - content.length;

  return (
    <div className="px-4 pb-6 pt-2 flex-shrink-0 relative">
      {/* @Mention / #Channel autocomplete */}
      {mentionState && mentionCandidates.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-bg-floating border border-black/30 rounded-lg shadow-xl overflow-hidden z-30 max-h-64 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs text-text-muted font-semibold uppercase tracking-wide border-b border-black/20">
            {mentionState.type === '@' ? 'Members & Roles' : 'Channels'}
            {mentionState.query && ` — ${mentionState.query}`}
          </div>
          {mentionCandidates.map((c, i) => (
            <button
              key={c.id}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === mentionState.selectedIdx ? 'bg-brand/20' : 'hover:bg-white/[0.06]'}`}
              onMouseDown={e => { e.preventDefault(); insertMention(c); }}
              onMouseEnter={() => setMentionState(s => s ? { ...s, selectedIdx: i } : null)}
            >
              {(c as any).isRole ? (
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: colorToHex((c as any).color) + '33', color: colorToHex((c as any).color) }}>@</span>
              ) : (c as any).isChannel ? (
                <span className="w-6 h-6 flex items-center justify-center text-interactive-muted text-lg flex-shrink-0">#</span>
              ) : (
                <Avatar userId={c.id} username={c.label} avatarHash={c.avatar} size={24} />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-text-header text-sm font-medium truncate block">{c.label}</span>
                {c.sublabel && <span className="text-text-muted text-xs truncate block">{c.sublabel}</span>}
              </div>
              {i === mentionState.selectedIdx && <span className="text-text-muted text-xs flex-shrink-0">↵</span>}
            </button>
          ))}
        </div>
      )}

      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-bg-secondary rounded-t text-sm text-text-muted border-b border-[#1e1f22]">
          <span>
            Replying to{' '}
            <span className="font-medium text-text-header">
              {replyTo.author.displayName || replyTo.author.username}
            </span>
          </span>
          <button onClick={onClearReply} className="hover:text-text-header transition-colors text-lg leading-none">×</button>
        </div>
      )}

      <div
        className={`flex items-end gap-2 bg-[#383a40] rounded-lg px-3 py-2.5 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        {/* File upload button */}
        <Tooltip content="Upload a File" side="top">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-header transition-colors disabled:opacity-50"
          >
            <Plus size={20} />
          </button>
        </Tooltip>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx,.zip"
          className="hidden"
          onChange={e => handleFileUpload(e.target.files)}
        />

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled || uploading}
          placeholder={disabled ? 'You do not have permission to send messages here.' : `Message #${channelName}`}
          maxLength={MAX_LENGTH}
          rows={1}
          className="flex-1 bg-transparent text-text-header placeholder-text-muted text-sm resize-none outline-none leading-relaxed min-h-[24px] max-h-[300px] overflow-y-auto"
        />

        {/* Character counter */}
        {content.length > MAX_LENGTH * 0.9 && (
          <span className={`text-xs flex-shrink-0 ${remaining < 0 ? 'text-danger' : 'text-text-muted'}`}>
            {remaining}
          </span>
        )}

        {/* Right action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {uploading && (
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          )}
          <Tooltip content="Send a Gift" side="top">
            <button className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-header transition-colors">
              <Gift size={18} />
            </button>
          </Tooltip>
          <Tooltip content="Open GIF picker" side="top">
            <button className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-header transition-colors font-bold text-xs">
              GIF
            </button>
          </Tooltip>
          <Tooltip content="Open Sticker Picker" side="top">
            <button className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-header transition-colors">
              <Sticker size={18} />
            </button>
          </Tooltip>
          <Tooltip content="Open Emoji Picker" side="top">
            <button className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-header transition-colors">
              <Smile size={18} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
