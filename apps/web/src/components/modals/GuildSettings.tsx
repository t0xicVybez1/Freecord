import { useState, useRef, useEffect } from 'react';
import {
  Settings, Shield, Users, Hash, Globe, Trash2, X, Copy, Check,
  UserX, Ban, Plus, Webhook, Smile, FileText, Crown, ChevronRight,
  Lock, Volume2, Megaphone, Mic, MicOff, Headphones, VolumeX,
  Calendar, ShieldAlert, Link2, Eye
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { useGuildsStore } from '../../stores/guilds';
import { useAuthStore } from '../../stores/auth';
import { useChannelsStore } from '../../stores/channels';
import { useShallow } from 'zustand/react/shallow';
import { api } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import type { Guild, GuildMember, GuildBan, Role, Channel } from '@freecord/types';
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

type Section = 'overview' | 'roles' | 'members' | 'channels' | 'emojis' | 'webhooks' | 'audit-log' | 'invites' | 'bans' | 'delete' | 'vanity-url' | 'scheduled-events' | 'automod';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode; danger?: boolean; separator?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: <Settings size={16} /> },
  { id: 'roles', label: 'Roles', icon: <Shield size={16} /> },
  { id: 'emojis', label: 'Emoji', icon: <Smile size={16} /> },
  { id: 'webhooks', label: 'Webhooks', icon: <Webhook size={16} /> },
  { id: 'channels', label: 'Channels', icon: <Hash size={16} /> },
  { id: 'vanity-url', label: 'Vanity URL', icon: <Link2 size={16} /> },
  { id: 'scheduled-events', label: 'Events', icon: <Calendar size={16} /> },
  { id: 'automod', label: 'AutoMod', icon: <ShieldAlert size={16} />, separator: true },
  { id: 'members', label: 'Members', icon: <Users size={16} /> },
  { id: 'invites', label: 'Invites', icon: <Globe size={16} /> },
  { id: 'bans', label: 'Bans', icon: <Ban size={16} /> },
  { id: 'audit-log', label: 'Audit Log', icon: <FileText size={16} />, separator: true },
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

interface WebhookData {
  id: string;
  name: string;
  avatar: string | null;
  channelId: string;
  guildId: string;
  token?: string;
}

interface AuditLogEntry {
  id: string;
  actionType: string;
  userId: string | null;
  targetId: string | null;
  reason: string | null;
  createdAt: string;
  user?: { id: string; username: string; avatar: string | null };
}

interface EmojiData {
  id: string;
  name: string;
  animated: boolean;
  url?: string;
  roles?: string[];
}

interface ChannelEditState {
  name: string;
  topic: string;
  nsfw: boolean;
  slowmode: number;
  bitrate: number;
  userLimit: number;
}

interface ScheduledEvent {
  id: string; name: string; description?: string;
  scheduledStartTime: string; scheduledEndTime?: string;
  status: number; entityType: number;
  entityMetadata?: { location?: string };
}

interface AutoModRule {
  id: string; name: string; enabled: boolean;
  triggerType: number; eventType: number; actions: any[];
}

export function GuildSettingsModal({ guildId, onClose }: GuildSettingsProps) {
  const { user } = useAuthStore();
  const { getGuild, updateGuild, removeGuild } = useGuildsStore();
  const navigate = useNavigate();
  const guild = getGuild(guildId);
  const channels = useChannelsStore(useShallow(s => s.getGuildChannels(guildId)));

  const [section, setSection] = useState<Section>('overview');
  const [name, setName] = useState(guild?.name || '');
  const [description, setDescription] = useState((guild as any)?.description || '');
  const [afkChannelId, setAfkChannelId] = useState((guild as any)?.afkChannelId || '');
  const [afkTimeout, setAfkTimeout] = useState((guild as any)?.afkTimeout || 300);
  const [verificationLevel, setVerificationLevel] = useState((guild as any)?.verificationLevel || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Members state
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [rolePickerMemberId, setRolePickerMemberId] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<{ userId: string; username: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [timeoutTarget, setTimeoutTarget] = useState<string | null>(null);
  const [timeoutDuration, setTimeoutDuration] = useState(60);

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

  // Emojis state
  const [emojis, setEmojis] = useState<EmojiData[]>([]);
  const [emojisLoading, setEmojisLoading] = useState(false);
  const emojiFileRef = useRef<HTMLInputElement>(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookChannel, setNewWebhookChannel] = useState('');
  const [copiedWebhook, setCopiedWebhook] = useState('');

  // Audit log state
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterUser, setAuditFilterUser] = useState('');

  // Channel settings state
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channelEdit, setChannelEdit] = useState<ChannelEditState>({ name: '', topic: '', nsfw: false, slowmode: 0, bitrate: 64000, userLimit: 0 });
  const [channelSaving, setChannelSaving] = useState(false);
  const [channelTab, setChannelTab] = useState<'overview' | 'permissions'>('overview');
  // Permission overwrites: map of roleId -> { allow: bigint, deny: bigint }
  const [overwrites, setOverwrites] = useState<Record<string, { allow: bigint; deny: bigint }>>({});
  const [overwritesSaving, setOverwritesSaving] = useState(false);
  // Channel drag-and-drop reorder
  const [channelOrder, setChannelOrder] = useState<string[]>([]);
  const [dragChannelId, setDragChannelId] = useState<string | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);

  // Vanity URL state
  const [vanityCode, setVanityCode] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [vanityLoading, setVanityLoading] = useState(false);
  const [vanityMsg, setVanityMsg] = useState('');

  // Scheduled Events state
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', description: '', scheduledStartTime: '', scheduledEndTime: '', location: '' });
  const [eventSaving, setEventSaving] = useState(false);

  // AutoMod state
  const [automodRules, setAutomodRules] = useState<AutoModRule[]>([]);
  const [automodLoading, setAutomodLoading] = useState(false);
  const [showAutomodForm, setShowAutomodForm] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', triggerType: 1, keyword: '', action: 1 });
  const [automodSaving, setAutomodSaving] = useState(false);

  // Close role picker on outside click
  useEffect(() => {
    if (!rolePickerMemberId) return;
    const handler = () => setRolePickerMemberId(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [rolePickerMemberId]);

  if (!guild) return null;

  const isOwner = guild.ownerId === user?.id;
  const textChannels = channels.filter(c => c.type === ChannelType.GUILD_TEXT);

  // Fetch data when section changes
  useEffect(() => {
    if (section === 'members') {
      setMembersLoading(true);
      api.get<GuildMember[]>(`/api/v1/guilds/${guildId}/members`)
        .then(setMembers).catch(() => {}).finally(() => setMembersLoading(false));
    } else if (section === 'invites') {
      setInvitesLoading(true);
      api.get<InviteData[]>(`/api/v1/guilds/${guildId}/invites`)
        .then(setInvites).catch(() => {}).finally(() => setInvitesLoading(false));
    } else if (section === 'bans') {
      setBansLoading(true);
      api.get<GuildBan[]>(`/api/v1/guilds/${guildId}/bans`)
        .then(setBans).catch(() => {}).finally(() => setBansLoading(false));
    } else if (section === 'emojis') {
      setEmojisLoading(true);
      api.get<EmojiData[]>(`/api/v1/guilds/${guildId}/emojis`)
        .then(setEmojis).catch(() => {}).finally(() => setEmojisLoading(false));
    } else if (section === 'webhooks') {
      setWebhooksLoading(true);
      if (!newWebhookChannel && textChannels.length) setNewWebhookChannel(textChannels[0].id);
      api.get<WebhookData[]>(`/api/v1/guilds/${guildId}/webhooks`)
        .then(setWebhooks).catch(() => {}).finally(() => setWebhooksLoading(false));
    } else if (section === 'audit-log') {
      setAuditLoading(true);
      api.get<{ entries: AuditLogEntry[] }>(`/api/v1/guilds/${guildId}/audit-logs`)
        .then(r => setAuditLog(r.entries || [])).catch(() => {}).finally(() => setAuditLoading(false));
    } else if (section === 'vanity-url') {
      api.get<{ code: string | null }>(`/api/v1/guilds/${guildId}/vanity-url`)
        .then(r => { setVanityCode(r.code || ''); }).catch(() => {})
      setIsPublic((guild as any).isPublic || false);
    } else if (section === 'scheduled-events') {
      setEventsLoading(true);
      api.get<ScheduledEvent[]>(`/api/v1/guilds/${guildId}/scheduled-events`)
        .then(setEvents).catch(() => {}).finally(() => setEventsLoading(false));
    } else if (section === 'automod') {
      setAutomodLoading(true);
      api.get<AutoModRule[]>(`/api/v1/guilds/${guildId}/auto-moderation/rules`)
        .then(setAutomodRules).catch(() => {}).finally(() => setAutomodLoading(false));
    } else if (section === 'channels') {
      // Initialize channel order from current channels (non-category)
      const nonCat = channels.filter(c => c.type !== ChannelType.GUILD_CATEGORY).sort((a, b) => (a.position || 0) - (b.position || 0));
      setChannelOrder(nonCat.map(c => c.id));
    }
  }, [section, guildId]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const updated = await api.patch<Guild>(`/api/v1/guilds/${guildId}`, {
        name: name.trim(),
        description: description || null,
        afkChannelId: afkChannelId || null,
        afkTimeout: Number(afkTimeout),
        verificationLevel: Number(verificationLevel),
      });
      updateGuild(guildId, updated);
      setSuccess('Server settings saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) { setError(e.message || 'Failed to save settings'); }
    finally { setLoading(false); }
  };

  const handleTimeout = async (userId: string, minutes: number) => {
    const until = minutes > 0 ? new Date(Date.now() + minutes * 60 * 1000).toISOString() : null;
    try {
      await api.patch(`/api/v1/guilds/${guildId}/members/${userId}`, { communicationDisabledUntil: until });
      setMembers(prev => prev.map(m => m.user.id === userId ? { ...m, communicationDisabledUntil: until } as any : m));
      setTimeoutTarget(null);
    } catch (e: any) { setError(e.message || 'Failed to timeout member'); }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== guild.name) { setError(`Please type "${guild.name}" to confirm.`); return; }
    setLoading(true);
    try {
      await api.delete(`/api/v1/guilds/${guildId}`);
      removeGuild(guildId); onClose(); navigate('/channels/@me');
    } catch (e: any) { setError(e.message || 'Failed to delete server'); }
    finally { setLoading(false); }
  };

  const handleTransferOwnership = async () => {
    const target = members.find(m => m.user.username.toLowerCase() === transferTarget.toLowerCase());
    if (!target) { setError('Member not found'); return; }
    setLoading(true);
    try {
      const updated = await api.patch<Guild>(`/api/v1/guilds/${guildId}`, { ownerId: target.user.id });
      updateGuild(guildId, { ownerId: updated.ownerId });
      setSuccess('Ownership transferred!'); setShowTransfer(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) { setError(e.message || 'Failed to transfer ownership'); }
    finally { setLoading(false); }
  };

  const handleKick = async (userId: string) => {
    try {
      await api.delete(`/api/v1/guilds/${guildId}/members/${userId}`);
      setMembers(prev => prev.filter(m => m.user.id !== userId));
    } catch (e: any) { setError(e.message || 'Failed to kick member'); }
  };

  const handleBan = async (userId: string, reason: string) => {
    try {
      await api.put(`/api/v1/guilds/${guildId}/bans/${userId}`, { reason });
      setMembers(prev => prev.filter(m => m.user.id !== userId));
      setBanTarget(null); setBanReason('');
    } catch (e: any) { setError(e.message || 'Failed to ban member'); }
  };

  const handleToggleMute = async (userId: string, currentMute: boolean) => {
    try {
      await api.patch(`/api/v1/guilds/${guildId}/members/${userId}`, { mute: !currentMute });
      setMembers(prev => prev.map(m => m.user.id === userId ? { ...m, mute: !currentMute } : m));
    } catch (e: any) { setError(e.message || 'Failed to update mute'); }
  };

  const handleToggleDeafen = async (userId: string, currentDeaf: boolean) => {
    try {
      await api.patch(`/api/v1/guilds/${guildId}/members/${userId}`, { deaf: !currentDeaf });
      setMembers(prev => prev.map(m => m.user.id === userId ? { ...m, deaf: !currentDeaf } : m));
    } catch (e: any) { setError(e.message || 'Failed to update deafen'); }
  };

  const handleAddRole = async (userId: string, roleId: string) => {
    try {
      await api.put(`/api/v1/guilds/${guildId}/members/${userId}/roles/${roleId}`)
      setMembers(prev => prev.map(m => m.user.id === userId ? { ...m, roles: [...m.roles, roleId] } : m))
    } catch (e: any) { setError(e.message || 'Failed to add role') }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    try {
      await api.delete(`/api/v1/guilds/${guildId}/members/${userId}/roles/${roleId}`)
      setMembers(prev => prev.map(m => m.user.id === userId ? { ...m, roles: m.roles.filter(r => r !== roleId) } : m))
    } catch (e: any) { setError(e.message || 'Failed to remove role') }
  };

  const handleCreateInvite = async () => {
    const textChannel = channels.find(c => c.type === ChannelType.GUILD_TEXT);
    if (!textChannel) return;
    setInvitesLoading(true);
    try {
      const invite = await api.post<InviteData>(`/api/v1/channels/${textChannel.id}/invites`, { maxAge: 86400, maxUses: 0 });
      setInvites(prev => [invite, ...prev]);
    } catch (e: any) { setError(e.message || 'Failed to create invite'); }
    finally { setInvitesLoading(false); }
  };

  const handleDeleteInvite = async (code: string) => {
    try {
      await api.delete(`/api/v1/invites/${code}`);
      setInvites(prev => prev.filter(i => i.code !== code));
    } catch (e: any) { setError(e.message || 'Failed to delete invite'); }
  };

  const handleCopyInvite = (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard?.writeText(url) ?? (() => {
      const el = document.createElement('textarea');
      el.value = url; el.style.position = 'fixed'; el.style.opacity = '0';
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    })();
    setCopiedCode(code); setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleUnban = async (userId: string) => {
    try {
      await api.delete(`/api/v1/guilds/${guildId}/bans/${userId}`);
      setBans(prev => prev.filter(b => b.user.id !== userId));
    } catch (e: any) { setError(e.message || 'Failed to unban user'); }
  };

  const selectRole = (role: Role) => {
    setSelectedRole(role); setEditName(role.name); setEditColor(role.color);
    setEditPerms(role.permissions); setEditHoist(role.hoist); setEditMentionable(role.mentionable);
  };

  const hasPermBit = (perms: string, bit: bigint) => (BigInt(perms || '0') & bit) === bit;
  const togglePermBit = (bit: bigint) => {
    const bits = BigInt(editPerms || '0');
    setEditPerms(((bits & bit) === bit ? bits & ~bit : bits | bit).toString());
  };

  const handleCreateRole = async () => {
    setRoleSaving(true);
    try {
      const role = await api.post<Role>(`/api/v1/guilds/${guildId}/roles`, { name: 'new role' });
      updateGuild(guildId, { roles: [...guild.roles, role] });
      selectRole(role);
    } catch (e: any) { setError(e.message || 'Failed to create role'); }
    finally { setRoleSaving(false); }
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    setRoleSaving(true);
    try {
      const updated = await api.patch<Role>(`/api/v1/guilds/${guildId}/roles/${selectedRole.id}`, {
        name: editName || undefined, color: editColor, permissions: editPerms, hoist: editHoist, mentionable: editMentionable,
      });
      updateGuild(guildId, { roles: guild.roles.map(r => r.id === updated.id ? updated : r) });
      setSelectedRole(updated);
    } catch (e: any) { setError(e.message || 'Failed to save role'); }
    finally { setRoleSaving(false); }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole || selectedRole.name === '@everyone') return;
    setRoleSaving(true);
    try {
      await api.delete(`/api/v1/guilds/${guildId}/roles/${selectedRole.id}`);
      updateGuild(guildId, { roles: guild.roles.filter(r => r.id !== selectedRole.id) });
      setSelectedRole(null);
    } catch (e: any) { setError(e.message || 'Failed to delete role'); }
    finally { setRoleSaving(false); }
  };

  // Emoji handlers
  const handleUploadEmoji = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || 'emoji';
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const emoji = await api.post<EmojiData>(`/api/v1/guilds/${guildId}/emojis`, { name, image: reader.result });
        setEmojis(prev => [...prev, emoji]);
      } catch (e: any) { setError(e.message || 'Failed to upload emoji'); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteEmoji = async (emojiId: string) => {
    try {
      await api.delete(`/api/v1/guilds/${guildId}/emojis/${emojiId}`);
      setEmojis(prev => prev.filter(e => e.id !== emojiId));
    } catch (e: any) { setError(e.message || 'Failed to delete emoji'); }
  };

  // Webhook handlers
  const handleCreateWebhook = async () => {
    if (!newWebhookName.trim() || !newWebhookChannel) return;
    setWebhooksLoading(true);
    try {
      const wh = await api.post<WebhookData>(`/api/v1/channels/${newWebhookChannel}/webhooks`, { name: newWebhookName.trim() });
      setWebhooks(prev => [...prev, wh]);
      setNewWebhookName('');
    } catch (e: any) { setError(e.message || 'Failed to create webhook'); }
    finally { setWebhooksLoading(false); }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      await api.delete(`/api/v1/webhooks/${webhookId}`);
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
    } catch (e: any) { setError(e.message || 'Failed to delete webhook'); }
  };

  const handleCopyWebhookUrl = (wh: WebhookData) => {
    if (!wh.token) return;
    const url = `${window.location.origin.replace('3000', '3000')}/api/v1/webhooks/${wh.id}/${wh.token}`;
    navigator.clipboard?.writeText(url);
    setCopiedWebhook(wh.id); setTimeout(() => setCopiedWebhook(''), 2000);
  };

  // Channel reorder drag-and-drop handlers
  const handleDragStart = (id: string) => setDragChannelId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!dragChannelId || dragChannelId === id) return;
    setChannelOrder(prev => {
      const next = [...prev];
      const from = next.indexOf(dragChannelId);
      const to = next.indexOf(id);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragChannelId);
      return next;
    });
  };
  const handleDragEnd = async () => {
    setDragChannelId(null);
    setReorderSaving(true);
    try {
      const positions = channelOrder.map((id, i) => ({ id, position: i }));
      await api.patch(`/api/v1/guilds/${guildId}/channels`, positions);
      // Update local store
      channelOrder.forEach((id, i) => useChannelsStore.getState().updateChannel(id, { position: i }));
    } catch {}
    setReorderSaving(false);
  };

  // Channel settings handlers
  const selectChannel = (ch: Channel) => {
    setSelectedChannel(ch);
    setChannelEdit({ name: ch.name, topic: ch.topic || '', nsfw: ch.nsfw || false, slowmode: ch.slowmode || 0, bitrate: ch.bitrate || 64000, userLimit: ch.userLimit || 0 });
    setChannelTab('overview');
    // Load existing permission overwrites from channel data
    const existing: Record<string, { allow: bigint; deny: bigint }> = {};
    ((ch as any).permissionOverwrites || []).forEach((ow: any) => {
      if (ow.type === 0) existing[ow.id] = { allow: BigInt(ow.allow || '0'), deny: BigInt(ow.deny || '0') };
    });
    setOverwrites(existing);
  };

  const handleSaveOverwrite = async (roleId: string) => {
    if (!selectedChannel) return;
    setOverwritesSaving(true);
    const ow = overwrites[roleId] || { allow: 0n, deny: 0n };
    try {
      await api.put(`/api/v1/channels/${selectedChannel.id}/permissions/${roleId}`, {
        type: 0,
        allow: ow.allow.toString(),
        deny: ow.deny.toString(),
      });
    } catch (e: any) { setError(e.message || 'Failed to save permission'); }
    finally { setOverwritesSaving(false); }
  };

  const toggleOverwrite = (roleId: string, bit: bigint, current: 'allow' | 'deny' | 'inherit') => {
    setOverwrites(prev => {
      const ow = prev[roleId] || { allow: 0n, deny: 0n };
      let { allow, deny } = ow;
      // Cycle: inherit -> allow -> deny -> inherit
      if (current === 'inherit') { allow |= bit; deny &= ~bit; }
      else if (current === 'allow') { deny |= bit; allow &= ~bit; }
      else { allow &= ~bit; deny &= ~bit; }
      return { ...prev, [roleId]: { allow, deny } };
    });
  };

  const handleSaveChannel = async () => {
    if (!selectedChannel) return;
    setChannelSaving(true);
    try {
      const updated = await api.patch<Channel>(`/api/v1/channels/${selectedChannel.id}`, channelEdit);
      setSelectedChannel(updated);
      useChannelsStore.getState().updateChannel(updated.id, updated);
      setSuccess('Channel saved!'); setTimeout(() => setSuccess(''), 2000);
    } catch (e: any) { setError(e.message || 'Failed to save channel'); }
    finally { setChannelSaving(false); }
  };

  const handleDeleteChannel = async () => {
    if (!selectedChannel) return;
    setChannelSaving(true);
    try {
      await api.delete(`/api/v1/channels/${selectedChannel.id}`);
      useChannelsStore.getState().removeChannel(selectedChannel.id);
      setSelectedChannel(null);
    } catch (e: any) { setError(e.message || 'Failed to delete channel'); }
    finally { setChannelSaving(false); }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();
  const formatExpiry = (iso: string | null) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d < new Date() ? 'Expired' : d.toLocaleDateString();
  };
  const formatAuditAction = (type: string) => type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());

  const channelIcon = (ch: Channel) => {
    if (ch.type === ChannelType.GUILD_VOICE || ch.type === ChannelType.GUILD_STAGE_VOICE) return <Volume2 size={14} className="text-interactive-muted" />;
    if (ch.type === ChannelType.GUILD_ANNOUNCEMENT) return <Megaphone size={14} className="text-interactive-muted" />;
    if (ch.nsfw) return <Lock size={14} className="text-interactive-muted" />;
    return <Hash size={14} className="text-interactive-muted" />;
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
            <div key={s.id}>
              {s.separator && <div className="my-1 h-px bg-white/[0.06] mx-2" />}
              <button
                onClick={() => { setSection(s.id); setError(''); setSuccess(''); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-left ${
                  section === s.id
                    ? s.danger ? 'bg-danger/20 text-danger' : 'bg-bg-primary text-text-header'
                    : s.danger ? 'text-danger hover:bg-danger/10' : 'text-text-muted hover:bg-bg-primary hover:text-text-header'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            </div>
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
            <button onClick={onClose} className="flex items-center gap-1 text-text-muted hover:text-text-header transition-colors">
              <X size={20} />
              <kbd className="text-xs border border-[#1e1f22] rounded px-1">ESC</kbd>
            </button>
          </div>

          {/* ── OVERVIEW ── */}
          {section === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                    {guild.icon ? <img src={guild.icon} alt={guild.name} className="w-full h-full object-cover" /> : guild.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <p className="text-white text-xs font-bold text-center">CHANGE ICON</p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  const formData = new FormData(); formData.append('file', file);
                  try { const updated = await api.upload<Guild>(`/api/v1/guilds/${guildId}/icon`, formData); updateGuild(guildId, updated); } catch {}
                }} />
                <div>
                  <h3 className="text-text-header font-bold text-lg">{guild.name}</h3>
                  <p className="text-text-muted text-sm">{guild.memberCount} members</p>
                </div>
              </div>

              <Input label="SERVER NAME" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} />

              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Server Description</label>
                <textarea
                  className="w-full bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none resize-none"
                  rows={3}
                  placeholder="Tell people what your server is about"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={120}
                />
                <p className="text-text-muted text-xs mt-0.5 text-right">{description.length}/120</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">AFK Channel</label>
                  <select
                    className="w-full bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                    value={afkChannelId}
                    onChange={e => setAfkChannelId(e.target.value)}
                  >
                    <option value="">No AFK Channel</option>
                    {channels.filter(c => c.type === ChannelType.GUILD_VOICE).map(c => (
                      <option key={c.id} value={c.id}>🔊 {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">AFK Timeout</label>
                  <select
                    className="w-full bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                    value={afkTimeout}
                    onChange={e => setAfkTimeout(Number(e.target.value))}
                  >
                    {[[60,'1 minute'],[300,'5 minutes'],[900,'15 minutes'],[1800,'30 minutes'],[3600,'1 hour']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Verification Level</label>
                <select
                  className="w-full bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                  value={verificationLevel}
                  onChange={e => setVerificationLevel(Number(e.target.value))}
                >
                  <option value={0}>None — Unrestricted</option>
                  <option value={1}>Low — Must have verified email</option>
                  <option value={2}>Medium — Registered for 5 minutes</option>
                  <option value={3}>High — Member for 10 minutes</option>
                  <option value={4}>Highest — Must have verified phone</option>
                </select>
              </div>

              {error && <p className="text-danger text-sm">{error}</p>}
              {success && <p className="text-success text-sm">{success}</p>}

              <Button onClick={handleSave} loading={loading} disabled={!name.trim()}>
                Save Changes
              </Button>

              {/* Ownership transfer */}
              {isOwner && (
                <div className="border-t border-white/[0.06] pt-6 mt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown size={16} className="text-warning" />
                    <h3 className="text-text-header font-semibold">Transfer Ownership</h3>
                  </div>
                  <p className="text-text-muted text-sm mb-3">Transfer server ownership to another member. You will lose owner privileges.</p>
                  {!showTransfer ? (
                    <button className="text-sm text-warning hover:underline" onClick={() => setShowTransfer(true)}>Transfer Ownership…</button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        className="w-full bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-warning outline-none"
                        placeholder="Enter member username"
                        value={transferTarget}
                        onChange={e => setTransferTarget(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button variant="danger" onClick={handleTransferOwnership} loading={loading}>Confirm Transfer</Button>
                        <button className="text-sm text-text-muted hover:text-text-header" onClick={() => setShowTransfer(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ROLES ── */}
          {section === 'roles' && (
            <div className="flex gap-4" style={{ minHeight: 480 }}>
              <div className="w-44 flex-shrink-0 flex flex-col bg-bg-tertiary rounded-lg overflow-hidden">
                {isOwner && (
                  <button className="flex items-center gap-2 px-3 py-2.5 text-sm text-brand hover:bg-brand/10 transition-colors border-b border-black/20 font-medium" onClick={handleCreateRole}>
                    <Plus size={14} /> Create Role
                  </button>
                )}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {guild.roles.slice().sort((a, b) => b.position - a.position).map(role => (
                    <button key={role.id} onClick={() => selectRole(role)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors truncate ${selectedRole?.id === role.id ? 'bg-brand/20 text-white' : 'text-text-muted hover:bg-white/[0.06] hover:text-text-header'}`}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colorToHex(role.color) }} />
                      <span className="truncate">{role.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedRole ? (
                  <div className="space-y-5">
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <Input label="ROLE NAME" value={editName} onChange={e => setEditName(e.target.value)} disabled={selectedRole.name === '@everyone'} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Color</label>
                        <input type="color" value={colorToHex(editColor)} onChange={e => setEditColor(parseInt(e.target.value.replace('#', ''), 16))} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editHoist} onChange={e => setEditHoist(e.target.checked)} className="rounded" />
                        <span className="text-sm text-text-header">Display separately</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editMentionable} onChange={e => setEditMentionable(e.target.checked)} className="rounded" />
                        <span className="text-sm text-text-header">Mentionable</span>
                      </label>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Permissions</p>
                      <div className="space-y-4">
                        {PERMISSION_GROUPS.map(group => (
                          <div key={group.label}>
                            <p className="text-xs text-text-muted font-medium mb-1.5">{group.label}</p>
                            <div className="space-y-1">
                              {group.perms.map(perm => (
                                <label key={perm.key} className="flex items-center gap-2 cursor-pointer group/perm">
                                  <input type="checkbox" checked={hasPermBit(editPerms, perm.bit)} onChange={() => togglePermBit(perm.bit)} className="rounded" />
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
                      {isOwner && <Button onClick={handleSaveRole} loading={roleSaving}>Save Changes</Button>}
                      {isOwner && selectedRole.name !== '@everyone' && (
                        <Button variant="danger" onClick={handleDeleteRole} loading={roleSaving}><Trash2 size={14} className="mr-1" /> Delete Role</Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                    <Shield size={32} className="text-text-muted" />
                    <p className="text-text-muted text-sm">Select a role to edit</p>
                    {isOwner && <button className="text-brand text-sm hover:underline" onClick={handleCreateRole}>or create a new one</button>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── EMOJI ── */}
          {section === 'emojis' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-text-muted text-xs uppercase tracking-wide font-semibold">{emojis.length} / 50 Emoji</p>
                {isOwner && (
                  <>
                    <Button onClick={() => emojiFileRef.current?.click()} disabled={emojis.length >= 50} className="text-xs py-1 px-3">
                      <Plus size={14} className="mr-1" /> Upload Emoji
                    </Button>
                    <input ref={emojiFileRef} type="file" accept="image/*,image/gif" className="hidden" onChange={handleUploadEmoji} />
                  </>
                )}
              </div>
              {emojisLoading ? (
                <p className="text-text-muted text-sm">Loading emoji...</p>
              ) : emojis.length === 0 ? (
                <div className="bg-bg-tertiary rounded-lg p-8 text-center">
                  <Smile size={32} className="text-text-muted mx-auto mb-2" />
                  <p className="text-text-muted text-sm">No custom emoji yet.</p>
                  {isOwner && <p className="text-text-muted text-xs mt-1">Upload up to 50 emoji (PNG, JPG, GIF)</p>}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {emojis.map(emoji => (
                    <div key={emoji.id} className="bg-bg-tertiary rounded-lg p-3 flex flex-col items-center gap-2 group relative">
                      {emoji.animated
                        ? <img src={`https://cdn.discordapp.com/emojis/${emoji.id}.gif`} alt={emoji.name} className="w-10 h-10 object-contain" />
                        : emoji.url
                          ? <img src={emoji.url} alt={emoji.name} className="w-10 h-10 object-contain" />
                          : <div className="w-10 h-10 bg-bg-primary rounded flex items-center justify-center text-text-muted text-xs">{emoji.name[0]}</div>
                      }
                      <p className="text-text-muted text-xs truncate w-full text-center">:{emoji.name}:</p>
                      {isOwner && (
                        <button
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-danger transition-all"
                          onClick={() => handleDeleteEmoji(emoji.id)}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {error && <p className="text-danger text-sm">{error}</p>}
            </div>
          )}

          {/* ── WEBHOOKS ── */}
          {section === 'webhooks' && (
            <div className="space-y-4">
              {isOwner && (
                <div className="bg-bg-tertiary rounded-lg p-4 space-y-3">
                  <p className="text-text-header font-semibold text-sm">Create Webhook</p>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-bg-primary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                      placeholder="Webhook name"
                      value={newWebhookName}
                      onChange={e => setNewWebhookName(e.target.value)}
                    />
                    <select
                      className="bg-bg-primary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                      value={newWebhookChannel}
                      onChange={e => setNewWebhookChannel(e.target.value)}
                    >
                      {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                    <Button onClick={handleCreateWebhook} loading={webhooksLoading} disabled={!newWebhookName.trim()}>Create</Button>
                  </div>
                </div>
              )}
              {webhooksLoading && webhooks.length === 0 ? (
                <p className="text-text-muted text-sm">Loading webhooks...</p>
              ) : webhooks.length === 0 ? (
                <div className="bg-bg-tertiary rounded-lg p-8 text-center">
                  <Webhook size={32} className="text-text-muted mx-auto mb-2" />
                  <p className="text-text-muted text-sm">No webhooks yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-text-muted text-xs uppercase tracking-wide font-semibold">{webhooks.length} Webhooks</p>
                  {webhooks.map(wh => {
                    const ch = channels.find(c => c.id === wh.channelId);
                    return (
                      <div key={wh.id} className="flex items-center gap-3 bg-bg-tertiary rounded-lg px-4 py-3">
                        <div className="w-8 h-8 rounded-full bg-bg-primary flex items-center justify-center flex-shrink-0">
                          {wh.avatar ? <img src={wh.avatar} alt={wh.name} className="w-full h-full rounded-full object-cover" /> : <Webhook size={16} className="text-text-muted" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-text-header text-sm font-medium truncate">{wh.name}</p>
                          <p className="text-text-muted text-xs">#{ch?.name || 'unknown-channel'}</p>
                        </div>
                        {wh.token && (
                          <button className="p-1.5 text-text-muted hover:text-white transition-colors" onClick={() => handleCopyWebhookUrl(wh)} title="Copy webhook URL">
                            {copiedWebhook === wh.id ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                          </button>
                        )}
                        {isOwner && (
                          <button className="p-1.5 text-text-muted hover:text-danger transition-colors" onClick={() => handleDeleteWebhook(wh.id)}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {error && <p className="text-danger text-sm">{error}</p>}
            </div>
          )}

          {/* ── CHANNELS ── */}
          {section === 'channels' && (
            <div className="flex gap-4" style={{ minHeight: 480 }}>
              <div className="w-48 flex-shrink-0 flex flex-col bg-bg-tertiary rounded-lg overflow-hidden">
                <div className="px-2 pt-2 pb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Channels</span>
                  {reorderSaving && <span className="text-xs text-text-muted">Saving...</span>}
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {(channelOrder.length > 0 ? channelOrder.map(id => channels.find(c => c.id === id)).filter(Boolean) as typeof channels : channels.filter(c => c.type !== ChannelType.GUILD_CATEGORY)).map(ch => (
                    <div
                      key={ch.id}
                      draggable={isOwner}
                      onDragStart={() => handleDragStart(ch.id)}
                      onDragOver={e => handleDragOver(e, ch.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => selectChannel(ch)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors truncate cursor-pointer ${dragChannelId === ch.id ? 'opacity-40' : ''} ${selectedChannel?.id === ch.id ? 'bg-brand/20 text-white' : 'text-text-muted hover:bg-white/[0.06] hover:text-text-header'}`}
                    >
                      {isOwner && <span className="text-text-muted cursor-grab flex-shrink-0" title="Drag to reorder">⠿</span>}
                      {channelIcon(ch)}
                      <span className="truncate">{ch.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedChannel ? (
                  <div className="space-y-4">
                    {/* Tab switcher */}
                    <div className="flex gap-1 border-b border-black/20 pb-2">
                      {(['overview', 'permissions'] as const).map(tab => (
                        <button key={tab} onClick={() => setChannelTab(tab)}
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors capitalize ${channelTab === tab ? 'bg-brand/20 text-white' : 'text-text-muted hover:text-text-header'}`}>
                          {tab}
                        </button>
                      ))}
                    </div>

                    {channelTab === 'overview' && (
                      <>
                        <Input label="CHANNEL NAME" value={channelEdit.name} onChange={e => setChannelEdit(s => ({ ...s, name: e.target.value }))} />
                        {(selectedChannel.type === ChannelType.GUILD_TEXT || selectedChannel.type === ChannelType.GUILD_ANNOUNCEMENT) && (
                          <>
                            <div>
                              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Channel Topic</label>
                              <textarea
                                className="w-full bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none resize-none"
                                rows={3}
                                placeholder="Let everyone know how to use this channel."
                                value={channelEdit.topic}
                                onChange={e => setChannelEdit(s => ({ ...s, topic: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Slowmode</label>
                              <select
                                className="w-full bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                                value={channelEdit.slowmode}
                                onChange={e => setChannelEdit(s => ({ ...s, slowmode: Number(e.target.value) }))}
                              >
                                {[[0,'Off'],[5,'5s'],[10,'10s'],[15,'15s'],[30,'30s'],[60,'1m'],[120,'2m'],[300,'5m'],[600,'10m'],[900,'15m'],[1800,'30m'],[3600,'1h'],[7200,'2h'],[21600,'6h']].map(([v, l]) => (
                                  <option key={v} value={v}>{l}</option>
                                ))}
                              </select>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={channelEdit.nsfw} onChange={e => setChannelEdit(s => ({ ...s, nsfw: e.target.checked }))} className="rounded" />
                              <span className="text-sm text-text-header">Age-restricted channel (NSFW)</span>
                            </label>
                          </>
                        )}
                        {(selectedChannel.type === ChannelType.GUILD_VOICE || selectedChannel.type === ChannelType.GUILD_STAGE_VOICE) && (
                          <>
                            <div>
                              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Bitrate</label>
                              <input type="range" min={8000} max={384000} step={8000} value={channelEdit.bitrate}
                                onChange={e => setChannelEdit(s => ({ ...s, bitrate: Number(e.target.value) }))}
                                className="w-full" />
                              <p className="text-text-muted text-xs mt-1">{Math.round(channelEdit.bitrate / 1000)}kbps</p>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">User Limit</label>
                              <input type="number" min={0} max={99} value={channelEdit.userLimit}
                                onChange={e => setChannelEdit(s => ({ ...s, userLimit: Number(e.target.value) }))}
                                className="w-full bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                                placeholder="0 = unlimited" />
                            </div>
                          </>
                        )}
                        {error && <p className="text-danger text-sm">{error}</p>}
                        {success && <p className="text-success text-sm">{success}</p>}
                        <div className="flex gap-2">
                          {isOwner && <Button onClick={handleSaveChannel} loading={channelSaving}>Save Changes</Button>}
                          {isOwner && (
                            <Button variant="danger" onClick={handleDeleteChannel} loading={channelSaving}><Trash2 size={14} className="mr-1" /> Delete Channel</Button>
                          )}
                        </div>
                      </>
                    )}

                    {channelTab === 'permissions' && (
                      <div className="space-y-3">
                        <p className="text-text-muted text-xs">Set permissions per role. Click a permission to cycle: Inherit → Allow → Deny.</p>
                        {(guild.roles || []).map(role => {
                          const ow = overwrites[role.id] || { allow: 0n, deny: 0n };
                          const CHANNEL_PERMS = [
                            { label: 'View Channel', bit: 1n << 10n },
                            { label: 'Send Messages', bit: 1n << 11n },
                            { label: 'Read Message History', bit: 1n << 16n },
                            { label: 'Manage Messages', bit: 1n << 13n },
                            { label: 'Embed Links', bit: 1n << 14n },
                            { label: 'Attach Files', bit: 1n << 15n },
                            { label: 'Add Reactions', bit: 1n << 6n },
                            { label: 'Mention Everyone', bit: 1n << 17n },
                            { label: 'Connect (Voice)', bit: 1n << 20n },
                            { label: 'Speak (Voice)', bit: 1n << 21n },
                          ];
                          return (
                            <div key={role.id} className="bg-bg-tertiary rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-text-header flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6,'0')}` : '#99aab5' }} />
                                  {role.name}
                                </span>
                                {isOwner && (
                                  <button
                                    onClick={() => handleSaveOverwrite(role.id)}
                                    disabled={overwritesSaving}
                                    className="text-xs text-brand hover:underline"
                                  >
                                    Save
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-1">
                                {CHANNEL_PERMS.map(perm => {
                                  const isAllow = (ow.allow & perm.bit) !== 0n;
                                  const isDeny = (ow.deny & perm.bit) !== 0n;
                                  const state = isAllow ? 'allow' : isDeny ? 'deny' : 'inherit';
                                  return (
                                    <button
                                      key={perm.label}
                                      onClick={() => isOwner && toggleOverwrite(role.id, perm.bit, state)}
                                      className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                                        state === 'allow' ? 'bg-green-500/20 text-green-400' :
                                        state === 'deny' ? 'bg-danger/20 text-danger' :
                                        'text-text-muted hover:bg-white/[0.04]'
                                      } ${!isOwner ? 'cursor-default' : 'cursor-pointer'}`}
                                    >
                                      <span>{perm.label}</span>
                                      <span className="font-bold">{state === 'allow' ? '✓' : state === 'deny' ? '✗' : '—'}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                    <Hash size={32} className="text-text-muted" />
                    <p className="text-text-muted text-sm">Select a channel to edit its settings</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MEMBERS ── */}
          {section === 'members' && (
            <div className="space-y-3">
              {/* Timeout dialog */}
              {timeoutTarget && (
                <div className="bg-bg-tertiary border border-brand/30 rounded-lg p-4 space-y-3">
                  <p className="text-text-header font-semibold text-sm">Timeout Member</p>
                  <select
                    className="w-full bg-bg-primary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                    value={timeoutDuration}
                    onChange={e => setTimeoutDuration(Number(e.target.value))}
                  >
                    {[[60,'1 minute'],[300,'5 minutes'],[600,'10 minutes'],[1800,'30 minutes'],[3600,'1 hour'],[86400,'1 day'],[604800,'1 week']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button onClick={() => handleTimeout(timeoutTarget, timeoutDuration)}>Apply Timeout</Button>
                    <button className="text-sm text-text-muted hover:text-text-header" onClick={() => setTimeoutTarget(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Ban confirmation dialog */}
              {banTarget && (
                <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 space-y-3">
                  <p className="text-danger font-semibold">Ban {banTarget.username}?</p>
                  <input
                    className="w-full bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-danger outline-none"
                    placeholder="Reason (optional)"
                    value={banReason}
                    onChange={e => setBanReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button variant="danger" onClick={() => handleBan(banTarget.userId, banReason)}>Ban User</Button>
                    <button className="text-sm text-text-muted hover:text-text-header" onClick={() => { setBanTarget(null); setBanReason(''); }}>Cancel</button>
                  </div>
                </div>
              )}
              {membersLoading ? (
                <p className="text-text-muted text-sm">Loading members...</p>
              ) : members.length === 0 ? (
                <p className="text-text-muted text-sm">No members found.</p>
              ) : (
                <>
                  <p className="text-text-muted text-xs uppercase tracking-wide font-semibold">{members.length} Members</p>
                  {members.map(member => (
                    <div key={member.user.id} className="flex items-start gap-3 bg-bg-tertiary rounded-lg px-4 py-3">
                      <Avatar userId={member.user.id} username={member.user.username} avatarHash={member.user.avatar} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-header text-sm font-medium truncate">
                          {member.nickname || member.user.username}
                          {member.user.id === guild.ownerId && <span className="ml-2 text-xs text-brand font-normal">Owner</span>}
                        </p>
                        <p className="text-text-muted text-xs">Joined {formatDate(member.joinedAt)}</p>
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
                                      onClick={() => { handleAddRole(member.user.id, role.id); setRolePickerMemberId(null); }}>
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
                        <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                          <button
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${(member as any).mute ? 'text-danger bg-danger/10 hover:bg-danger/20' : 'text-text-muted hover:text-white hover:bg-white/[0.06]'}`}
                            onClick={() => handleToggleMute(member.user.id, !!(member as any).mute)}
                            title={(member as any).mute ? 'Unmute' : 'Server Mute'}
                          >
                            {(member as any).mute ? <MicOff size={13} /> : <Mic size={13} />}
                          </button>
                          <button
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${(member as any).deaf ? 'text-danger bg-danger/10 hover:bg-danger/20' : 'text-text-muted hover:text-white hover:bg-white/[0.06]'}`}
                            onClick={() => handleToggleDeafen(member.user.id, !!(member as any).deaf)}
                            title={(member as any).deaf ? 'Undeafen' : 'Server Deafen'}
                          >
                            {(member as any).deaf ? <VolumeX size={13} /> : <Headphones size={13} />}
                          </button>
                          <button
                            className="flex items-center gap-1 text-xs text-text-muted hover:text-danger hover:bg-danger/10 px-2 py-1 rounded transition-colors"
                            onClick={() => handleKick(member.user.id)}
                          >
                            <UserX size={13} /> Kick
                          </button>
                          <button
                            className="flex items-center gap-1 text-xs text-text-muted hover:text-warning hover:bg-warning/10 px-2 py-1 rounded transition-colors"
                            onClick={() => setTimeoutTarget(member.user.id)}
                            title="Timeout (communication disabled)"
                          >
                            ⏱ Timeout
                          </button>
                          <button
                            className="flex items-center gap-1 text-xs text-text-muted hover:text-danger hover:bg-danger/10 px-2 py-1 rounded transition-colors"
                            onClick={() => { setBanTarget({ userId: member.user.id, username: member.user.username }); setBanReason(''); }}
                          >
                            <Ban size={13} /> Ban
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
              {error && <p className="text-danger text-sm">{error}</p>}
            </div>
          )}

          {/* ── INVITES ── */}
          {section === 'invites' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-text-muted text-xs uppercase tracking-wide font-semibold">{invites.length} Invites</p>
                {channels.some(c => c.type === ChannelType.GUILD_TEXT) && (
                  <Button onClick={handleCreateInvite} loading={invitesLoading} className="text-xs py-1 px-3">Create Invite</Button>
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
                    <button className="p-1.5 text-text-muted hover:text-white transition-colors" onClick={() => handleCopyInvite(invite.code)} title="Copy invite link">
                      {copiedCode === invite.code ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                    </button>
                    <button className="p-1.5 text-text-muted hover:text-danger transition-colors" onClick={() => handleDeleteInvite(invite.code)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
              {error && <p className="text-danger text-sm">{error}</p>}
            </div>
          )}

          {/* ── BANS ── */}
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
                  <p className="text-text-muted text-xs uppercase tracking-wide font-semibold">{bans.length} Bans</p>
                  {bans.map(ban => (
                    <div key={ban.user.id} className="flex items-center gap-3 bg-bg-tertiary rounded-lg px-4 py-3">
                      <Avatar userId={ban.user.id} username={ban.user.username} avatarHash={ban.user.avatar} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-header text-sm font-medium truncate">{ban.user.username}</p>
                        {ban.reason && <p className="text-text-muted text-xs truncate">Reason: {ban.reason}</p>}
                      </div>
                      {isOwner && (
                        <button className="flex items-center gap-1 text-xs text-brand hover:bg-brand/10 px-2 py-1 rounded transition-colors" onClick={() => handleUnban(ban.user.id)}>
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

          {/* ── AUDIT LOG ── */}
          {section === 'audit-log' && (
            <div className="space-y-3">
              {/* Filters */}
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                  placeholder="Filter by action (e.g. BAN)"
                  value={auditFilterAction}
                  onChange={e => setAuditFilterAction(e.target.value)}
                />
                <input
                  className="flex-1 bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                  placeholder="Filter by username"
                  value={auditFilterUser}
                  onChange={e => setAuditFilterUser(e.target.value)}
                />
                {(auditFilterAction || auditFilterUser) && (
                  <button
                    onClick={() => { setAuditFilterAction(''); setAuditFilterUser(''); }}
                    className="px-2 text-text-muted hover:text-text-header transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {auditLoading ? (
                <p className="text-text-muted text-sm">Loading audit log...</p>
              ) : auditLog.length === 0 ? (
                <div className="bg-bg-tertiary rounded-lg p-8 text-center">
                  <FileText size={32} className="text-text-muted mx-auto mb-2" />
                  <p className="text-text-muted text-sm">No audit log entries yet.</p>
                </div>
              ) : (() => {
                const filtered = auditLog.filter(e => {
                  const matchAction = !auditFilterAction || e.actionType.toLowerCase().includes(auditFilterAction.toLowerCase());
                  const matchUser = !auditFilterUser || (e.user?.username || '').toLowerCase().includes(auditFilterUser.toLowerCase());
                  return matchAction && matchUser;
                });
                return filtered.length === 0 ? (
                  <p className="text-text-muted text-sm text-center py-8">No entries match your filters.</p>
                ) : (
                  <div className="space-y-1">
                    {filtered.map(entry => (
                      <div key={entry.id} className="flex items-start gap-3 bg-bg-tertiary rounded-lg px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-text-header text-sm font-medium">{formatAuditAction(entry.actionType)}</span>
                            {entry.targetId && (
                              <span className="text-text-muted text-xs font-mono truncate">→ {entry.targetId}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {entry.user && <span className="text-text-muted text-xs">by {entry.user.username}</span>}
                            {entry.reason && <span className="text-text-muted text-xs">· "{entry.reason}"</span>}
                            <span className="text-text-muted text-xs ml-auto">{formatDate(entry.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── VANITY URL ── */}
          {section === 'vanity-url' && isOwner && (
            <div className="space-y-6">
              <div>
                <h2 className="text-text-header font-bold text-xl mb-1">Vanity URL</h2>
                <p className="text-text-muted text-sm">Give your server a custom invite link. The code must be unique and lowercase.</p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-bg-tertiary rounded-lg">
                <Eye size={20} className="text-text-muted flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-text-header text-sm font-semibold">Server Visibility</p>
                  <p className="text-text-muted text-xs">Allow this server to appear in Explore Servers</p>
                </div>
                <button
                  onClick={async () => {
                    const next = !isPublic;
                    setIsPublic(next);
                    try { await api.patch(`/api/v1/guilds/${guildId}`, { isPublic: next }); } catch { setIsPublic(!next); }
                  }}
                  className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${isPublic ? 'bg-brand' : 'bg-bg-floating'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Custom Invite Code</label>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-sm flex-shrink-0">{window.location.origin}/invite/</span>
                  <input
                    className="flex-1 bg-bg-tertiary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                    placeholder="your-server"
                    value={vanityCode}
                    onChange={e => setVanityCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    maxLength={32}
                  />
                </div>
                {vanityMsg && <p className={`text-sm mt-1 ${vanityMsg.includes('aved') ? 'text-success' : 'text-danger'}`}>{vanityMsg}</p>}
              </div>

              <Button
                loading={vanityLoading}
                onClick={async () => {
                  setVanityLoading(true); setVanityMsg('');
                  try {
                    await api.patch(`/api/v1/guilds/${guildId}/vanity-url`, { code: vanityCode || null });
                    setVanityMsg('Saved!');
                  } catch (e: any) {
                    setVanityMsg(e?.message || 'Failed to save');
                  } finally { setVanityLoading(false); }
                }}
              >
                Save Vanity URL
              </Button>
            </div>
          )}

          {/* ── SCHEDULED EVENTS ── */}
          {section === 'scheduled-events' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-text-header font-bold text-xl mb-1">Scheduled Events</h2>
                  <p className="text-text-muted text-sm">Create and manage events for your community.</p>
                </div>
                {isOwner && (
                  <Button onClick={() => { setShowEventForm(true); setNewEvent({ name: '', description: '', scheduledStartTime: '', scheduledEndTime: '', location: '' }); }}>
                    <Plus size={16} /> Create Event
                  </Button>
                )}
              </div>

              {showEventForm && (
                <div className="bg-bg-tertiary rounded-lg p-4 space-y-3">
                  <h3 className="text-text-header font-semibold">New Event</h3>
                  <Input label="EVENT NAME" value={newEvent.name} onChange={e => setNewEvent(s => ({ ...s, name: e.target.value }))} />
                  <div>
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Description</label>
                    <textarea
                      className="w-full bg-bg-secondary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none resize-none"
                      rows={2} maxLength={1000}
                      value={newEvent.description}
                      onChange={e => setNewEvent(s => ({ ...s, description: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Start Time</label>
                      <input type="datetime-local" className="w-full bg-bg-secondary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                        value={newEvent.scheduledStartTime} onChange={e => setNewEvent(s => ({ ...s, scheduledStartTime: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">End Time (optional)</label>
                      <input type="datetime-local" className="w-full bg-bg-secondary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                        value={newEvent.scheduledEndTime} onChange={e => setNewEvent(s => ({ ...s, scheduledEndTime: e.target.value }))} />
                    </div>
                  </div>
                  <Input label="Location (optional)" value={newEvent.location} onChange={e => setNewEvent(s => ({ ...s, location: e.target.value }))} />
                  <div className="flex gap-2">
                    <Button loading={eventSaving} disabled={!newEvent.name || !newEvent.scheduledStartTime} onClick={async () => {
                      setEventSaving(true);
                      try {
                        const created = await api.post<ScheduledEvent>(`/api/v1/guilds/${guildId}/scheduled-events`, {
                          name: newEvent.name, description: newEvent.description || undefined,
                          scheduledStartTime: new Date(newEvent.scheduledStartTime).toISOString(),
                          scheduledEndTime: newEvent.scheduledEndTime ? new Date(newEvent.scheduledEndTime).toISOString() : undefined,
                          entityMetadata: newEvent.location ? { location: newEvent.location } : undefined,
                          entityType: 3,
                        });
                        setEvents(prev => [...prev, created]);
                        setShowEventForm(false);
                      } catch {} finally { setEventSaving(false); }
                    }}>Create Event</Button>
                    <button className="text-text-muted text-sm hover:text-text-header" onClick={() => setShowEventForm(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {eventsLoading ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
              ) : events.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No scheduled events yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map(ev => (
                    <div key={ev.id} className="flex items-start gap-3 p-3 bg-bg-tertiary rounded-lg">
                      <Calendar size={18} className="text-brand flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-header font-semibold text-sm">{ev.name}</p>
                        {ev.description && <p className="text-text-muted text-xs mt-0.5 line-clamp-1">{ev.description}</p>}
                        <p className="text-text-muted text-xs mt-1">
                          {new Date(ev.scheduledStartTime).toLocaleString()}
                          {ev.scheduledEndTime && ` → ${new Date(ev.scheduledEndTime).toLocaleString()}`}
                        </p>
                        {ev.entityMetadata?.location && <p className="text-text-muted text-xs">📍 {ev.entityMetadata.location}</p>}
                      </div>
                      {isOwner && (
                        <button className="text-text-muted hover:text-danger transition-colors flex-shrink-0" onClick={async () => {
                          try { await api.delete(`/api/v1/guilds/${guildId}/scheduled-events/${ev.id}`); setEvents(prev => prev.filter(e => e.id !== ev.id)); } catch {}
                        }}><X size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── AUTOMOD ── */}
          {section === 'automod' && isOwner && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-text-header font-bold text-xl mb-1">AutoMod</h2>
                  <p className="text-text-muted text-sm">Automatically detect and act on content that violates your rules.</p>
                </div>
                <Button onClick={() => { setShowAutomodForm(true); setNewRule({ name: '', triggerType: 1, keyword: '', action: 1 }); }}>
                  <Plus size={16} /> Add Rule
                </Button>
              </div>

              {showAutomodForm && (
                <div className="bg-bg-tertiary rounded-lg p-4 space-y-3">
                  <h3 className="text-text-header font-semibold">New Rule</h3>
                  <Input label="RULE NAME" value={newRule.name} onChange={e => setNewRule(s => ({ ...s, name: e.target.value }))} />
                  <div>
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Trigger</label>
                    <select className="w-full bg-bg-secondary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                      value={newRule.triggerType} onChange={e => setNewRule(s => ({ ...s, triggerType: Number(e.target.value) }))}>
                      <option value={1}>Keyword Filter</option>
                      <option value={3}>Spam</option>
                      <option value={4}>Mention Spam</option>
                    </select>
                  </div>
                  {newRule.triggerType === 1 && (
                    <Input label="KEYWORDS (comma-separated)" value={newRule.keyword}
                      onChange={e => setNewRule(s => ({ ...s, keyword: e.target.value }))} placeholder="badword1, badword2" />
                  )}
                  <div>
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Action</label>
                    <select className="w-full bg-bg-secondary text-text-normal rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                      value={newRule.action} onChange={e => setNewRule(s => ({ ...s, action: Number(e.target.value) }))}>
                      <option value={1}>Block Message</option>
                      <option value={2}>Send Alert</option>
                      <option value={3}>Timeout Member</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button loading={automodSaving} disabled={!newRule.name} onClick={async () => {
                      setAutomodSaving(true);
                      try {
                        const keywords = newRule.keyword.split(',').map(k => k.trim()).filter(Boolean);
                        const created = await api.post<AutoModRule>(`/api/v1/guilds/${guildId}/auto-moderation/rules`, {
                          name: newRule.name, triggerType: newRule.triggerType,
                          triggerMetadata: keywords.length ? { keywordFilter: keywords } : {},
                          actions: [{ type: newRule.action }],
                        });
                        setAutomodRules(prev => [...prev, created]);
                        setShowAutomodForm(false);
                      } catch {} finally { setAutomodSaving(false); }
                    }}>Create Rule</Button>
                    <button className="text-text-muted text-sm hover:text-text-header" onClick={() => setShowAutomodForm(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {automodLoading ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
              ) : automodRules.length === 0 && !showAutomodForm ? (
                <div className="text-center py-12 text-text-muted">
                  <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No AutoMod rules yet.</p>
                  <p className="text-xs mt-1">Add a rule to start automatically moderating content.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {automodRules.map(rule => (
                    <div key={rule.id} className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg">
                      <ShieldAlert size={18} className={rule.enabled ? 'text-success' : 'text-text-muted'} />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-header font-semibold text-sm">{rule.name}</p>
                        <p className="text-text-muted text-xs">
                          {rule.triggerType === 1 ? 'Keyword' : rule.triggerType === 3 ? 'Spam' : 'Mention Spam'} · {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await api.patch(`/api/v1/guilds/${guildId}/auto-moderation/rules/${rule.id}`, { enabled: !rule.enabled });
                            setAutomodRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
                          } catch {}
                        }}
                        className={`w-8 h-5 rounded-full transition-colors relative flex-shrink-0 ${rule.enabled ? 'bg-brand' : 'bg-bg-floating'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </button>
                      <button className="text-text-muted hover:text-danger transition-colors flex-shrink-0" onClick={async () => {
                        try { await api.delete(`/api/v1/guilds/${guildId}/auto-moderation/rules/${rule.id}`); setAutomodRules(prev => prev.filter(r => r.id !== rule.id)); } catch {}
                      }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── DELETE ── */}
          {section === 'delete' && isOwner && (
            <div className="space-y-4">
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
                <h3 className="text-danger font-bold mb-2">⚠️ Delete Server</h3>
                <p className="text-text-muted text-sm">
                  Are you sure you want to delete <strong className="text-text-header">{guild.name}</strong>?
                  This action cannot be undone and will permanently delete this server including all its channels and messages.
                </p>
              </div>
              <Input label={`TYPE "${guild.name}" TO CONFIRM`} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={guild.name} />
              {error && <p className="text-danger text-sm">{error}</p>}
              <Button variant="danger" onClick={handleDelete} loading={loading} disabled={deleteConfirm !== guild.name} className="gap-2">
                <Trash2 size={16} /> Delete Server
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
