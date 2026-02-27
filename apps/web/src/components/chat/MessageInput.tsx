import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Gift, Sticker, Smile, Mic, MicOff, Image } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { Avatar } from '../ui/Avatar';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useMessagesStore } from '../../stores/messages';
import { gateway } from '../../lib/gateway';
import type { Message } from '@freecord/types';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [content, channelId, replyTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;
    setContent('');
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
    <div className="px-4 pb-6 pt-2 flex-shrink-0">
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
          onChange={e => {
            setContent(e.target.value);
            if (e.target.value) sendTyping();
          }}
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
