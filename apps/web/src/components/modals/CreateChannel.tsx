import { useState } from 'react';
import { Hash, Volume2, Lock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useChannelsStore } from '../../stores/channels';
import { api } from '../../lib/api';
import type { Channel } from '@freecord/types';
import { ChannelType } from '@freecord/types';

interface CreateChannelProps {
  guildId: string;
  categoryId?: string;
  onClose: () => void;
}

export function CreateChannelModal({ guildId, categoryId, onClose }: CreateChannelProps) {
  const { addChannel } = useChannelsStore();
  const [type, setType] = useState<ChannelType>(ChannelType.GUILD_TEXT);
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const channel = await api.post<Channel>(`/api/v1/guilds/${guildId}/channels`, {
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        type,
        parentId: categoryId,
        isPrivate,
      });
      addChannel(channel);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Create Channel" size="sm">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Channel Type</p>
          <div className="space-y-1">
            {[
              { value: ChannelType.GUILD_TEXT, icon: Hash, label: 'Text Channel', desc: 'Post images, GIFs, stickers, opinions and puns' },
              { value: ChannelType.GUILD_VOICE, icon: Volume2, label: 'Voice Channel', desc: 'Hang out together with voice, video and screen share' },
            ].map(opt => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${
                  type === opt.value ? 'bg-bg-secondary' : 'hover:bg-bg-secondary/50'
                }`}
              >
                <input
                  type="radio"
                  value={opt.value}
                  checked={type === opt.value}
                  onChange={() => setType(opt.value as ChannelType)}
                  className="hidden"
                />
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${type === opt.value ? 'bg-brand/20' : 'bg-bg-tertiary'}`}>
                  <opt.icon size={20} className={type === opt.value ? 'text-brand' : 'text-text-muted'} />
                </div>
                <div>
                  <p className="text-text-header font-medium text-sm">{opt.label}</p>
                  <p className="text-text-muted text-xs">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Input
          label="CHANNEL NAME"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={type === ChannelType.GUILD_TEXT ? 'new-channel' : 'New Voice Channel'}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />

        <label className="flex items-start gap-3 cursor-pointer">
          <div
            onClick={() => setIsPrivate(v => !v)}
            className={`mt-0.5 w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${isPrivate ? 'bg-brand' : 'bg-bg-tertiary'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPrivate ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Lock size={14} className="text-text-muted" />
              <span className="text-text-header text-sm font-medium">Private Channel</span>
            </div>
            <p className="text-text-muted text-xs mt-0.5">
              Only selected members and roles will be able to view this channel.
            </p>
          </div>
        </label>

        {error && <p className="text-danger text-sm">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleCreate} loading={loading} disabled={!name.trim()} className="flex-1">
            Create Channel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
