import { useState } from 'react';
import { ArrowLeft, Plus, Compass } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useUIStore } from '../../stores/ui';
import { useGuildsStore } from '../../stores/guilds';
import { api } from '../../lib/api';
import type { Guild } from '@freecord/types';

type Step = 'choice' | 'create' | 'join';

interface CreateGuildProps {
  onClose: () => void;
}

export function CreateGuildModal({ onClose }: CreateGuildProps) {
  const { addGuild } = useGuildsStore();
  const [step, setStep] = useState<Step>('choice');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const guild = await api.post<Guild>('/guilds', { name: name.trim() });
      addGuild(guild);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create server');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const code = inviteCode.trim().split('/').pop() || inviteCode.trim();
      const guild = await api.post<Guild>(`/invites/${code}`, {});
      addGuild(guild);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Invalid invite link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="sm">
      {step === 'choice' && (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-header mb-2">Create a server</h2>
          <p className="text-text-muted text-sm mb-6">
            Your server is where you and your friends hang out. Make yours and start talking.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => setStep('create')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded bg-bg-secondary hover:bg-bg-primary text-text-header font-medium transition-colors text-left"
            >
              <Plus className="text-brand" size={20} />
              Create My Own
            </button>
            <button
              onClick={() => setStep('join')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded bg-bg-secondary hover:bg-bg-primary text-text-header font-medium transition-colors text-left"
            >
              <Compass className="text-green-400" size={20} />
              Join a Server
            </button>
          </div>
          <p className="mt-4 text-xs text-text-muted">
            Have an invite already?{' '}
            <button onClick={() => setStep('join')} className="text-brand hover:underline">Join a Server</button>
          </p>
        </div>
      )}

      {step === 'create' && (
        <div>
          <button onClick={() => setStep('choice')} className="flex items-center gap-1 text-text-muted hover:text-text-header text-sm mb-4">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="text-2xl font-bold text-text-header mb-1">Customize Your Server</h2>
          <p className="text-text-muted text-sm mb-6">
            Give your new server a personality with a name and an icon.
          </p>
          <Input
            label="SERVER NAME"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Awesome Server"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          {error && <p className="text-danger text-sm mt-2">{error}</p>}
          <div className="flex gap-2 mt-6">
            <Button variant="ghost" onClick={onClose} className="flex-1">Back</Button>
            <Button onClick={handleCreate} loading={loading} disabled={!name.trim()} className="flex-1">
              Create
            </Button>
          </div>
        </div>
      )}

      {step === 'join' && (
        <div>
          <button onClick={() => setStep('choice')} className="flex items-center gap-1 text-text-muted hover:text-text-header text-sm mb-4">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="text-2xl font-bold text-text-header mb-1">Join a Server</h2>
          <p className="text-text-muted text-sm mb-6">
            Enter an invite below to join an existing server.
          </p>
          <Input
            label="INVITE LINK"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            placeholder="https://freecord.app/invite/hTKzmak"
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
          {error && <p className="text-danger text-sm mt-2">{error}</p>}
          <div className="flex gap-2 mt-6">
            <Button variant="ghost" onClick={onClose} className="flex-1">Back</Button>
            <Button onClick={handleJoin} loading={loading} disabled={!inviteCode.trim()} className="flex-1">
              Join Server
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
