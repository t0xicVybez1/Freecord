import { useState } from 'react';
import { MessageCircle, UserPlus, UserMinus, Ban } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useAuthStore } from '../../stores/auth';
import { useUsersStore } from '../../stores/users';
import { api } from '../../lib/api';
import type { User } from '@freecord/types';

interface UserProfileProps {
  userId: string;
  onClose: () => void;
}

export function UserProfileModal({ userId, onClose }: UserProfileProps) {
  const { user: me } = useAuthStore();
  const { users, presences, relationships } = useUsersStore();
  const [loading, setLoading] = useState(false);

  const user = users[userId];
  const presence = presences[userId];
  const relationship = relationships.find(r => r.userId === userId || r.targetId === userId);

  if (!user) return null;
  const isSelf = me?.id === userId;
  const isFriend = relationship?.type === 'FRIEND';
  const isPending = relationship?.type === 'PENDING_OUTGOING';
  const isBlocked = relationship?.type === 'BLOCKED';

  const handleFriendAction = async () => {
    setLoading(true);
    try {
      if (isFriend) {
        await api.delete(`/api/v1/users/@me/relationships/${userId}`);
      } else if (!isPending) {
        await api.put(`/api/v1/users/@me/relationships/${userId}`, { type: 1 });
      }
    } catch {}
    setLoading(false);
  };

  const statusColors: Record<string, string> = {
    online: 'bg-status-online',
    idle: 'bg-status-idle',
    dnd: 'bg-status-dnd',
    offline: 'bg-status-offline',
  };

  return (
    <Modal isOpen onClose={onClose} size="sm" className="!p-0 overflow-hidden">
      {/* Banner */}
      <div className="h-24 bg-gradient-to-br from-brand to-purple-600" />

      <div className="px-4 pb-4">
        {/* Avatar */}
        <div className="-mt-10 mb-3 flex items-end justify-between">
          <div className="relative">
            <Avatar userId={user.id} username={user.username} avatarHash={user.avatar} size={80} className="ring-4 ring-bg-primary" />
            <div className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-bg-primary ${statusColors[presence?.status || 'offline'] || 'bg-status-offline'}`} />
          </div>
          {!isSelf && (
            <div className="flex gap-2 mt-12">
              {isFriend && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { /* open DM */ onClose(); }}
                  className="gap-1"
                >
                  <MessageCircle size={14} /> Message
                </Button>
              )}
              {!isBlocked && (
                <Button
                  variant={isFriend ? 'ghost' : 'secondary'}
                  size="sm"
                  loading={loading}
                  onClick={handleFriendAction}
                  className="gap-1"
                >
                  {isFriend ? <><UserMinus size={14} /> Remove Friend</> :
                   isPending ? 'Pending...' :
                   <><UserPlus size={14} /> Add Friend</>}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* User info */}
        <div className="bg-bg-tertiary rounded-lg p-3 space-y-3">
          <div>
            <h2 className="text-xl font-bold text-text-header">
              {user.displayName || user.username}
            </h2>
            <p className="text-text-muted text-sm">{user.username}#{user.discriminator}</p>
            {user.bot && <Badge variant="default" className="mt-1">BOT</Badge>}
          </div>

          {presence?.activities && presence.activities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                {presence.activities[0].type === 0 ? 'Playing' :
                 presence.activities[0].type === 1 ? 'Streaming' :
                 presence.activities[0].type === 2 ? 'Listening to' :
                 presence.activities[0].type === 3 ? 'Watching' : 'Status'}
              </p>
              <p className="text-text-header text-sm font-medium">{presence.activities[0].name}</p>
              {presence.activities[0].details && (
                <p className="text-text-muted text-xs">{presence.activities[0].details}</p>
              )}
            </div>
          )}

          {user.customStatus && (
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">About Me</p>
              <p className="text-text-header text-sm">{user.customStatus}</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
