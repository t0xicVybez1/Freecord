import { useState, useRef, useEffect } from 'react';
import { Settings, Shield, Users, Hash, Globe, Trash2, X, Copy, Check, UserX, Ban, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { useGuildsStore } from '../../stores/guilds';
import { useAuthStore } from '../../stores/auth';
import { useChannelsStore } from '../../stores/channels';
import { useShallow } from 'zustand/react/shallow';
import { api } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import type { Guild, GuildMember, GuildBan, Role } from '@freecord/types';
import { ChannelType } from '@freecord/types';

const PERMISSION_GROUPS: { label: string; perms: { key: string; label: string; bit: bigint }[] }[] = [
  { label: 'General', perms: [
    { key: 'ADMINISTRATOR', label: 'Administrator', bit: 1n << 3n },
    { key: 'MANAGE_GUILD', label: 'Manage Server', bit: 1n << 5n },
    { key: 'MANAGE_CHANNELS', label: 'Manage Channels', bit: 1n << 4n },
    { key: 'MANAGE_ROLES', label: 'Manage Roles', bit: 1n << 28n },
    { key: 'VIEW_AUDIT_LOG', label: 'View Audit Log', bit: 1n << 7n },
    { key: 'CREATE_INSTANT_INVITE', label: 'Create Invites', bit: 1n << 0n },
  ]},
  { label: 'Members', perms: [
    { key: 'KICK_MEMBERS', label: 'Kick Members', bit: 1n << 1n },
    { key: 'BAN_MEMBERS', label: 'Ban Members', bit: 1n << 2n },
    { key: 'MANAGE_NICKNAMES', label: 'Manage Nicknames', bit: 1n << 27n },
    { key: 'CHANGE_NICKNAME', label: 'Change Own Nickname', bit: 1n << 26n },
  ]},
  { label: 'Text Channels', perms: [
    { key: 'VIEW_CHANNEL', label: 'View Channels', bit: 1n << 10n },
    { key: 'SEND_MESSAGES', label: 'Send Messages', bit: 1n << 11n },
    { key: 'MANAGE_MESSAGES', label: 'Manage Messages', bit: 1n << 13n },
    { key: 'EMBED_LINKS', label: 'Embed Links', bit: 1n << 14n },
    { key: 'ATTACH_FILES', label: 'Attach Files', bit: 1n << 15n },
    { key: 'READ_MESSAGE_HISTORY', label: 'Read Message History', bit: 1n << 16n },
    { key: 'MENTION_EVERYONE', label: 'Mention Everyone', bit: 1n << 17n },
    { key: 'ADD_REACTIONS', label: 'Add Reactions', bit: 1n << 6n },
  ]},
  { label: 'Voice Channels', perms: [
    { key: 'CONNECT', label: 'Connect', bit: 1n << 20n },
    { key: 'SPEAK', label: 'Speak', bit: 1n << 21n },
    { key: 'STREAM', label: 'Video/Stream', bit: 1n << 9n },
    { key: 'MUTE_MEMBERS', label: 'Mute Members', bit: 1n << 22n },
    { key: 'DEAFEN_MEMBERS', label: 'Deafen Members', bit: 1n << 23n },
    { key: 'MOVE_MEMBERS', label: 'Move Members', bit: 1n << 24n },
  ]},
];

function colorToHex(color: number): string {
  return color ? `#${color.toString(16).padStart(6, '0')}` : '#99aab5';
}

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
  { id: 'bans', label: 'Bans', icon: <Ban size={16} /> },
  { id: 'delete', label: 'Delete Server', icon: <Trash2 size={16} />, danger: true },
];

interface InviteData {
  code: string;
  guildId: string;
  channelId: string;
  inviterId: string | null;
  uses: number;
  maxUses: number;
  maxAge: number;
  temporary: boolean;
  createdAt: string;
  expiresAt: string | null;
}

export function GuildSettingsModal({ guildId, onClose }: GuildSettingsProps) {
  const { user } = useAuthStore();
  const { getGuild, updateGuild, removeGuild } = useGuildsStore();
  const navigate = useNavigate();
  const guild = getGuild(guildId);
  const channels = useChannelsStore(useShallow(s => s.getGuildChannels(guildId)));

  const [section, setSection] = useState<Section>('overview');
  const [name, setName] = useState(guild?.name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Members state
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [rolePickerMemberId, setRolePickerMemberId] = useState<string | null>(null);

  // Invites state
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  // Bans state
  const [bans, setBans] = useState<GuildBan[]>([]);
  const [bansLoading, setBansLoading] = useState(false);

  // Roles edit state
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(0);
  const [editPerms, setEditPerms] = useState('0');
  const [editHoist, setEditHoist] = useState(false);
  const [editMentionable, setEditMentionable] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);

  // Close role picker on outside click
  useEffect(() => {
    if (!rolePickerMemberId) return;
    const handler = () => setRolePickerMemberId(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [rolePickerMemberId]);

  if (!guild) return null;

  const isOwner = guild.ownerId === user?.id;

  // Fetch data when section changes
  useEffect(() => {
    if (section === 'members') {
      setMembersLoading(true);
      api.get<GuildMember[]>(`/api/v1/guilds/${guildId}/members`)
        .then(setMembers)
        .catch(() => {})
        .finally(() => setMembersLoading(false));
    } else if (section === 'invites') {
      setInvitesLoading(true);
      api.get<InviteData[]>(`/api/v1/guilds/${guildId}/invites`)
        .then(setInvites)
        .catch(() => {})
        .finally(() => setInvitesLoading(false));
    } else if (section === 'bans') {
      setBansLoading(true);
      api.get<GuildBan[]>(`/api/v1/guilds/${guildId}/bans`)
        .then(setBans)
        .catch(() => {})
        .finally(() => setBansLoading(false));
    }
  }, [section, guildId]);

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

  const handleKick = async (userId: string) => {
    try {
      await api.delete(`/api/v1/guilds/${guildId}/members/${userId}`);
      setMembers(prev => prev.filter(m => m.user.id !== userId));
    } catch (e: any) {
      setError(e.message || 'Failed to kick member');
    }
  };

  const handleAddRole = async (userId: string, roleId: string) => {
    try {
      await api.put(`/api/v1/guilds/${guildId}/members/${userId}/roles/${roleId}`)
      setMembers(prev => prev.map(m =>
        m.user.id === userId ? { ...m, roles: [...m.roles, roleId] } : m
      ))
    } catch (e: any) {
      setError(e.message || 'Failed to add role')
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    try {
      await api.delete(`/api/v1/guilds/${guildId}/members/${userId}/roles/${roleId}`)
      setMembers(prev => prev.map(m =>
        m.user.id === userId ? { ...m, roles: m.roles.filter(r => r !== roleId) } : m
      ))
    } catch (e: any) {
      setError(e.message || 'Failed to remove role')
    }
  };

  const handleCreateInvite = async () => {
    const textChannel = channels.find(c => c.type === ChannelType.GUILD_TEXT);
    if (!textChannel) return;
    setInvitesLoading(true);
    try {
      const invite = await api.post<InviteData>(`/api/v1/channels/${textChannel.id}/invites`, {
        maxAge: 86400,
        maxUses: 0,
      });
      setInvites(prev => [invite, ...prev]);
    } catch (e: any) {
      setError(e.message || 'Failed to create invite');
    } finally {
      setInvitesLoading(false);
    }
  };

  const handleDeleteInvite = async (code: string) => {
    try {
      await api.delete(`/api/v1/invites/${code}`);
      setInvites(prev => prev.filter(i => i.code !== code));
    } catch (e: any) {
      setError(e.message || 'Failed to delete invite');
    }
  };

  const handleCopyInvite = (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    } else {
      // Fallback for non-HTTPS contexts
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleUnban = async (userId: string) => {
    try {
      await api.delete(`/api/v1/guilds/${guildId}/bans/${userId}`);
      setBans(prev => prev.filter(b => b.user.id !== userId));
    } catch (e: any) {
      setError(e.message || 'Failed to unban user');
    }
  };

  const selectRole = (role: Role) => {
    setSelectedRole(role);
    setEditName(role.name);
    setEditColor(role.color);
    setEditPerms(role.permissions);
    setEditHoist(role.hoist);
    setEditMentionable(role.mentionable);
  };

  const hasPermBit = (perms: string, bit: bigint) => {
    const bits = BigInt(perms || '0');
    return (bits & bit) === bit;
  };

  const togglePermBit = (bit: bigint) => {
    const bits = BigInt(editPerms || '0');
    const newBits = (bits & bit) === bit ? bits & ~bit : bits | bit;
    setEditPerms(newBits.toString());
  };

  const handleCreateRole = async () => {
    setRoleSaving(true);
    try {
      const role = await api.post<Role>(`/api/v1/guilds/${guildId}/roles`, { name: 'new role' });
      updateGuild(guildId, { roles: [...guild.roles, role] });
      selectRole(role);
    } catch (e: any) {
      setError(e.message || 'Failed to create role');
    } finally {
      setRoleSaving(false);
    }
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    setRoleSaving(true);
    try {
      const updated = await api.patch<Role>(`/api/v1/guilds/${guildId}/roles/${selectedRole.id}`, {
        name: editName || undefined,
        color: editColor,
        permissions: editPerms,
        hoist: editHoist,
        mentionable: editMentionable,
      });
      updateGuild(guildId, { roles: guild.roles.map(r => r.id === updated.id ? updated : r) });
      setSelectedRole(updated);
    } catch (e: any) {
      setError(e.message || 'Failed to save role');
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole || selectedRole.name === '@everyone') return;
    setRoleSaving(true);
    try {
      await api.delete(`/api/v1/guilds/${guildId}/roles/${selectedRole.id}`);
      updateGuild(guildId, { roles: guild.roles.filter(r => r.id !== selectedRole.id) });
      setSelectedRole(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete role');
    } finally {
      setRoleSaving(false);
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();
  const formatExpiry = (iso: string | null) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d < new Date() ? 'Expired' : d.toLocaleDateString();
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
              onClick={() => { setSection(s.id); setError(''); }}
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

          {section === 'members' && (
            <div className="space-y-3">
              {membersLoading ? (
                <p className="text-text-muted text-sm">Loading members...</p>
              ) : members.length === 0 ? (
                <p className="text-text-muted text-sm">No members found.</p>
              ) : (
                <>
                  <p className="text-text-muted text-xs uppercase tracking-wide font-semibold">
                    {members.length} Members
                  </p>
                  {members.map(member => (
                    <div key={member.user.id} className="flex items-start gap-3 bg-bg-tertiary rounded-lg px-4 py-3">
                      <Avatar
                        userId={member.user.id}
                        username={member.user.username}
                        avatarHash={member.user.avatar}
                        size={36}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-header text-sm font-medium truncate">
                          {member.nickname || member.user.username}
                          {member.user.id === guild.ownerId && (
                            <span className="ml-2 text-xs text-brand font-normal">Owner</span>
                          )}
                        </p>
                        <p className="text-text-muted text-xs">Joined {formatDate(member.joinedAt)}</p>
                        {/* Role pills */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {member.roles.map(roleId => {
                            const role = guild.roles.find(r => r.id === roleId);
                            if (!role || role.name === '@everyone') return null;
                            const hex = colorToHex(role.color);
                            return (
                              <span key={roleId} className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: hex + '33', color: hex, border: `1px solid ${hex}66` }}>
                                {role.name}
                                {isOwner && member.user.id !== guild.ownerId && (
                                  <button className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => handleRemoveRole(member.user.id, roleId)}>
                                    <X size={10} />
                                  </button>
                                )}
                              </span>
                            );
                          })}
                          {isOwner && member.user.id !== guild.ownerId && (
                            <div className="relative" onClick={e => e.stopPropagation()}>
                              <button
                                className="text-xs text-text-muted hover:text-white px-1.5 py-0.5 rounded border border-white/20 hover:border-white/40 transition-colors"
                                onClick={() => setRolePickerMemberId(rolePickerMemberId === member.user.id ? null : member.user.id)}
                              >
                                + Role
                              </button>
                              {rolePickerMemberId === member.user.id && (
                                <div className="absolute left-0 top-full mt-1 z-10 bg-bg-floating border border-black/30 rounded shadow-xl min-w-36 py-1">
                                  {guild.roles.filter(r => r.name !== '@everyone' && !member.roles.includes(r.id)).map(role => (
                                    <button key={role.id}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-header hover:bg-white/[0.06] text-left"
                                      onClick={() => { handleAddRole(member.user.id, role.id); setRolePickerMemberId(null); }}
                                    >
                                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorToHex(role.color) }} />
                                      {role.name}
                                    </button>
                                  ))}
                                  {guild.roles.filter(r => r.name !== '@everyone' && !member.roles.includes(r.id)).length === 0 && (
                                    <p className="px-3 py-1.5 text-xs text-text-muted">All roles assigned</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {isOwner && member.user.id !== user?.id && member.user.id !== guild.ownerId && (
                        <button
                          className="flex items-center gap-1 text-xs text-danger hover:bg-danger/10 px-2 py-1 rounded transition-colors flex-shrink-0"
                          onClick={() => handleKick(member.user.id)}
                        >
                          <UserX size={14} />
                          Kick
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
              {error && <p className="text-danger text-sm">{error}</p>}
            </div>
          )}

          {section === 'roles' && (
            <div className="flex gap-4" style={{ minHeight: 480 }}>
              {/* Role list */}
              <div className="w-44 flex-shrink-0 flex flex-col bg-bg-tertiary rounded-lg overflow-hidden">
                {isOwner && (
                  <button
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-brand hover:bg-brand/10 transition-colors border-b border-black/20 font-medium"
                    onClick={handleCreateRole}
                  >
                    <Plus size={14} /> Create Role
                  </button>
                )}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {guild.roles.slice().sort((a, b) => b.position - a.position).map(role => (
                    <button
                      key={role.id}
                      onClick={() => selectRole(role)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors truncate ${
                        selectedRole?.id === role.id
                          ? 'bg-brand/20 text-white'
                          : 'text-text-muted hover:bg-white/[0.06] hover:text-text-header'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colorToHex(role.color) }} />
                      <span className="truncate">{role.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Role editor */}
              <div className="flex-1 overflow-y-auto">
                {selectedRole ? (
                  <div className="space-y-5">
                    {/* Name + Color row */}
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <Input
                          label="ROLE NAME"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          disabled={selectedRole.name === '@everyone'}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Color</label>
                        <input
                          type="color"
                          value={colorToHex(editColor)}
                          onChange={e => setEditColor(parseInt(e.target.value.replace('#', ''), 16))}
                          className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                        />
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editHoist} onChange={e => setEditHoist(e.target.checked)}
                          className="rounded" />
                        <span className="text-sm text-text-header">Display separately</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editMentionable} onChange={e => setEditMentionable(e.target.checked)}
                          className="rounded" />
                        <span className="text-sm text-text-header">Mentionable</span>
                      </label>
                    </div>

                    {/* Permissions */}
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Permissions</p>
                      <div className="space-y-4">
                        {PERMISSION_GROUPS.map(group => (
                          <div key={group.label}>
                            <p className="text-xs text-text-muted font-medium mb-1.5">{group.label}</p>
                            <div className="space-y-1">
                              {group.perms.map(perm => (
                                <label key={perm.key} className="flex items-center gap-2 cursor-pointer group/perm">
                                  <input
                                    type="checkbox"
                                    checked={hasPermBit(editPerms, perm.bit)}
                                    onChange={() => togglePermBit(perm.bit)}
                                    className="rounded"
                                  />
                                  <span className="text-sm text-text-header group-hover/perm:text-white transition-colors">{perm.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {error && <p className="text-danger text-sm">{error}</p>}

                    <div className="flex gap-2 pb-4">
                      {isOwner && (
                        <Button onClick={handleSaveRole} loading={roleSaving}>Save Changes</Button>
                      )}
                      {isOwner && selectedRole.name !== '@everyone' && (
                        <Button variant="danger" onClick={handleDeleteRole} loading={roleSaving}>
                          <Trash2 size={14} className="mr-1" /> Delete Role
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                    <Shield size={32} className="text-text-muted" />
                    <p className="text-text-muted text-sm">Select a role to edit</p>
                    {isOwner && (
                      <button className="text-brand text-sm hover:underline" onClick={handleCreateRole}>
                        or create a new one
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'invites' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-text-muted text-xs uppercase tracking-wide font-semibold">
                  {invites.length} Invites
                </p>
                {channels.some(c => c.type === ChannelType.GUILD_TEXT) && (
                  <Button onClick={handleCreateInvite} loading={invitesLoading} className="text-xs py-1 px-3">
                    Create Invite
                  </Button>
                )}
              </div>
              {invitesLoading && invites.length === 0 ? (
                <p className="text-text-muted text-sm">Loading invites...</p>
              ) : invites.length === 0 ? (
                <p className="text-text-muted text-sm">No active invites.</p>
              ) : (
                invites.map(invite => (
                  <div key={invite.code} className="flex items-center gap-3 bg-bg-tertiary rounded-lg px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-text-header text-sm font-mono font-medium">{invite.code}</p>
                      <p className="text-text-muted text-xs">
                        {invite.uses}{invite.maxUses > 0 ? `/${invite.maxUses}` : ''} uses · Expires {formatExpiry(invite.expiresAt)}
                      </p>
                    </div>
                    <button
                      className="p-1.5 text-text-muted hover:text-white transition-colors"
                      onClick={() => handleCopyInvite(invite.code)}
                      title="Copy invite link"
                    >
                      {copiedCode === invite.code ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                    </button>
                    <button
                      className="p-1.5 text-text-muted hover:text-danger transition-colors"
                      onClick={() => handleDeleteInvite(invite.code)}
                      title="Delete invite"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
              {error && <p className="text-danger text-sm">{error}</p>}
            </div>
          )}

          {section === 'bans' && (
            <div className="space-y-3">
              {bansLoading ? (
                <p className="text-text-muted text-sm">Loading bans...</p>
              ) : bans.length === 0 ? (
                <div className="bg-bg-tertiary rounded-lg p-8 text-center">
                  <Ban size={32} className="text-text-muted mx-auto mb-2" />
                  <p className="text-text-muted text-sm">No bans. This server is a welcoming place!</p>
                </div>
              ) : (
                <>
                  <p className="text-text-muted text-xs uppercase tracking-wide font-semibold">
                    {bans.length} Bans
                  </p>
                  {bans.map(ban => (
                    <div key={ban.user.id} className="flex items-center gap-3 bg-bg-tertiary rounded-lg px-4 py-3">
                      <Avatar
                        userId={ban.user.id}
                        username={ban.user.username}
                        avatarHash={ban.user.avatar}
                        size={36}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-header text-sm font-medium truncate">{ban.user.username}</p>
                        {ban.reason && <p className="text-text-muted text-xs truncate">Reason: {ban.reason}</p>}
                      </div>
                      {isOwner && (
                        <button
                          className="flex items-center gap-1 text-xs text-brand hover:bg-brand/10 px-2 py-1 rounded transition-colors"
                          onClick={() => handleUnban(ban.user.id)}
                        >
                          Unban
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
              {error && <p className="text-danger text-sm">{error}</p>}
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
        </div>
      </div>
    </div>
  );
}
