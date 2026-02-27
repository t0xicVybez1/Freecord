import { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import type { GuildInvite } from '@freecord/types';

interface InviteModalProps {
  guildId: string;
  channelId: string;
  onClose: () => void;
}

const EXPIRY_OPTIONS = [
  { label: '30 minutes', value: 1800 },
  { label: '1 hour', value: 3600 },
  { label: '6 hours', value: 21600 },
  { label: '12 hours', value: 43200 },
  { label: '1 day', value: 86400 },
  { label: '7 days', value: 604800 },
  { label: 'Never', value: 0 },
];

const USE_OPTIONS = [
  { label: 'No limit', value: 0 },
  { label: '1 use', value: 1 },
  { label: '5 uses', value: 5 },
  { label: '10 uses', value: 10 },
  { label: '25 uses', value: 25 },
  { label: '50 uses', value: 50 },
  { label: '100 uses', value: 100 },
];

export function InviteModal({ guildId, channelId, onClose }: InviteModalProps) {
  const [invite, setInvite] = useState<GuildInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [maxAge, setMaxAge] = useState(86400);
  const [maxUses, setMaxUses] = useState(0);

  const createInvite = async () => {
    setLoading(true);
    try {
      const inv = await api.post<GuildInvite>(`/channels/${channelId}/invites`, { maxAge, maxUses });
      setInvite(inv);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { createInvite(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const inviteUrl = invite ? `${window.location.origin}/invite/${invite.code}` : '';

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen onClose={onClose} title="Invite People" size="sm">
      <div className="space-y-4">
        <p className="text-text-muted text-sm">Share this link with others to grant access to your server.</p>

        <div className="flex gap-2">
          <div className="flex-1 bg-bg-tertiary rounded px-3 py-2.5 text-sm text-text-header truncate">
            {loading ? <span className="text-text-muted">Generating...</span> : inviteUrl}
          </div>
          <Button onClick={handleCopy} disabled={loading || !inviteUrl} className="flex-shrink-0 gap-2">
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Expire After</label>
            <select
              value={maxAge}
              onChange={e => setMaxAge(Number(e.target.value))}
              className="w-full bg-bg-tertiary text-text-header text-sm rounded px-2 py-2 outline-none"
            >
              {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1.5">Max Uses</label>
            <select
              value={maxUses}
              onChange={e => setMaxUses(Number(e.target.value))}
              className="w-full bg-bg-tertiary text-text-header text-sm rounded px-2 py-2 outline-none"
            >
              {USE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={createInvite}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-brand hover:underline disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Generate a New Link
        </button>

        <p className="text-xs text-text-muted">
          Your invite link expires after{' '}
          {EXPIRY_OPTIONS.find(o => o.value === maxAge)?.label.toLowerCase()} and{' '}
          {maxUses === 0 ? 'has no use limit' : `${maxUses} use${maxUses !== 1 ? 's' : ''}`}.
        </p>
      </div>
    </Modal>
  );
}
