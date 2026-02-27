import { useState, useRef } from 'react';
import { Settings, Shield, Users, Hash, Globe, Trash2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { useGuildsStore } from '../../stores/guilds';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import type { Guild } from '@freecord/types';

interface GuildSettingsProps {
  guildId: string;
  onClose: () => void;
}

type Section = 'overview' | 'roles' | 'members' | 'invites' | 'bans' | 'delete';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode; danger?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: <Settings size={16} /> },
  { id: 'roles', label: 'Roles', icon: <Shield size={16} /> },
  { id: 'members', label: 'Members', icon: <Users size={16} /> },
  { id: 'invites', label: 'Invites', icon: <Globe size={16} /> },
  { id: 'bans', label: 'Bans', icon: <Shield size={16} /> },
  { id: 'delete', label: 'Delete Server', icon: <Trash2 size={16} />, danger: true },
];

export function GuildSettingsModal({ guildId, onClose }: GuildSettingsProps) {
  const { user } = useAuthStore();
  const { getGuild, updateGuild, removeGuild } = useGuildsStore();
  const navigate = useNavigate();
  const guild = getGuild(guildId);

  const [section, setSection] = useState<Section>('overview');
  const [name, setName] = useState(guild?.name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!guild) return null;

  const isOwner = guild.ownerId === user?.id;

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const updated = await api.patch<Guild>(`/api/v1/guilds/${guildId}`, { name: name.trim() });
      updateGuild(guildId, updated);
      setSuccess('Server settings saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== guild.name) {
      setError(`Please type "${guild.name}" to confirm.`);
      return;
    }
    setLoading(true);
    try {
      await api.delete(`/api/v1/guilds/${guildId}`);
      removeGuild(guildId);
      onClose();
      navigate('/channels/@me');
    } catch (e: any) {
      setError(e.message || 'Failed to delete server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-bg-primary">
      {/* Sidebar */}
      <div className="w-64 bg-bg-secondary flex flex-col">
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide px-2 mb-1 truncate">
            {guild.name}
          </p>
          {SECTIONS.filter(s => !s.danger || isOwner).map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-left ${
                section === s.id
                  ? s.danger ? 'bg-danger/20 text-danger' : 'bg-bg-primary text-text-header'
                  : s.danger ? 'text-danger hover:bg-danger/10' : 'text-text-muted hover:bg-bg-primary hover:text-text-header'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-text-header">
              {SECTIONS.find(s => s.id === section)?.label}
            </h1>
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-text-muted hover:text-text-header transition-colors"
            >
              <X size={20} />
              <kbd className="text-xs border border-[#1e1f22] rounded px-1">ESC</kbd>
            </button>
          </div>

          {section === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                    {guild.icon ? (
                      <img src={guild.icon} alt={guild.name} className="w-full h-full object-cover" />
                    ) : (
                      guild.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <p className="text-white text-xs font-bold text-center">CHANGE ICON</p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  try {
                    const updated = await api.upload<Guild>(`/api/v1/guilds/${guildId}/icon`, formData);
                    updateGuild(guildId, updated);
                  } catch {}
                }} />
                <div>
                  <h3 className="text-text-header font-bold text-lg">{guild.name}</h3>
                  <p className="text-text-muted text-sm">{guild.memberCount} members</p>
                </div>
              </div>

              <Input
                label="SERVER NAME"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />

              {error && <p className="text-danger text-sm">{error}</p>}
              {success && <p className="text-success text-sm">{success}</p>}

              <Button onClick={handleSave} loading={loading} disabled={!name.trim() || name === guild.name}>
                Save Changes
              </Button>
            </div>
          )}

          {section === 'delete' && isOwner && (
            <div className="space-y-4">
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
                <h3 className="text-danger font-bold mb-2">⚠️ Delete Server</h3>
                <p className="text-text-muted text-sm">
                  Are you sure you want to delete <strong className="text-text-header">{guild.name}</strong>?
                  This action cannot be undone and will permanently delete this server including all its channels and messages.
                </p>
              </div>
              <Input
                label={`TYPE "${guild.name}" TO CONFIRM`}
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={guild.name}
              />
              {error && <p className="text-danger text-sm">{error}</p>}
              <Button
                variant="danger"
                onClick={handleDelete}
                loading={loading}
                disabled={deleteConfirm !== guild.name}
                className="gap-2"
              >
                <Trash2 size={16} />
                Delete Server
              </Button>
            </div>
          )}

          {(section === 'roles' || section === 'members' || section === 'invites' || section === 'bans') && (
            <div className="bg-bg-tertiary rounded-lg p-8 text-center">
              <p className="text-text-muted">
                {section.charAt(0).toUpperCase() + section.slice(1)} management coming soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
