import { useState } from 'react';
import { User, Shield, Bell, Palette, Keyboard, LogOut, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../lib/api';
import type { User as UserType } from '@freecord/types';

interface UserSettingsProps {
  onClose: () => void;
}

type Section = 'account' | 'profile' | 'privacy' | 'notifications' | 'appearance' | 'keybinds';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'My Account', icon: <User size={16} /> },
  { id: 'profile', label: 'Profiles', icon: <User size={16} /> },
  { id: 'privacy', label: 'Privacy & Safety', icon: <Shield size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'keybinds', label: 'Keybinds', icon: <Keyboard size={16} /> },
];

export function UserSettingsModal({ onClose }: UserSettingsProps) {
  const { user, logout } = useAuthStore();
  const [section, setSection] = useState<Section>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Account form state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSaveAccount = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.patch('/api/v1/users/@me', {
        displayName: displayName || undefined,
        ...(email && currentPassword ? { email, password: currentPassword } : {}),
        ...(newPassword && currentPassword ? { newPassword, password: currentPassword } : {}),
      });
      setSuccess('Changes saved!');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-bg-primary">
      {/* Sidebar */}
      <div className="w-64 bg-bg-secondary flex flex-col">
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide px-2 mb-1">User Settings</p>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-left ${
                section === s.id
                  ? 'bg-bg-primary text-text-header'
                  : 'text-text-muted hover:bg-bg-primary hover:text-text-header'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
          <div className="mt-2 border-t border-[#1e1f22] pt-2">
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-danger hover:bg-danger/10 transition-colors text-left"
            >
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </div>

        {/* User panel at bottom */}
        {user && (
          <div className="p-3 border-t border-[#1e1f22] flex items-center gap-2">
            <Avatar user={user} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-text-header text-sm font-medium truncate">{user.displayName || user.username}</p>
              <p className="text-text-muted text-xs truncate">#{user.discriminator}</p>
            </div>
          </div>
        )}
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

          {section === 'account' && user && (
            <div className="space-y-6">
              {/* Profile card */}
              <div className="bg-bg-tertiary rounded-lg p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative group cursor-pointer">
                    <Avatar user={user} size="xl" />
                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <p className="text-white text-xs font-bold text-center">CHANGE AVATAR</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text-header">{user.username}</h3>
                    <p className="text-text-muted text-sm">#{user.discriminator}</p>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <Input
                  label="DISPLAY NAME"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder={user.username}
                />
                <Input
                  label="EMAIL (leave blank to keep current)"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  placeholder="new-email@example.com"
                />
                {(email || newPassword) && (
                  <Input
                    label="CURRENT PASSWORD (required)"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    type="password"
                    placeholder="Enter your current password"
                  />
                )}
                <Input
                  label="NEW PASSWORD (leave blank to keep current)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  type="password"
                  placeholder="New password"
                />
              </div>

              {error && <p className="text-danger text-sm">{error}</p>}
              {success && <p className="text-success text-sm">{success}</p>}

              <Button onClick={handleSaveAccount} loading={loading}>Save Changes</Button>
            </div>
          )}

          {section === 'appearance' && (
            <div className="space-y-6">
              <div className="bg-bg-tertiary rounded-lg p-4">
                <h3 className="text-text-header font-semibold mb-3">Theme</h3>
                <div className="flex gap-3">
                  {['Dark', 'Light', 'Amoled'].map(theme => (
                    <button
                      key={theme}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        theme === 'Dark'
                          ? 'bg-brand text-white'
                          : 'bg-bg-secondary text-text-muted hover:text-text-header'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-bg-tertiary rounded-lg p-4">
                <h3 className="text-text-header font-semibold mb-1">Message Display</h3>
                <p className="text-text-muted text-sm mb-3">Choose how messages look</p>
                <div className="flex gap-3">
                  {['Cozy', 'Compact'].map(mode => (
                    <button
                      key={mode}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        mode === 'Cozy'
                          ? 'bg-brand text-white'
                          : 'bg-bg-secondary text-text-muted hover:text-text-header'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <div className="space-y-4">
              <div className="bg-bg-tertiary rounded-lg p-4">
                <h3 className="text-text-header font-semibold mb-3">Desktop Notifications</h3>
                {[
                  { label: 'Enable Desktop Notifications', key: 'desktopNotifications' },
                  { label: 'Enable Unread Message Badge', key: 'unreadBadge' },
                  { label: 'Play sound for notifications', key: 'notificationSounds' },
                ].map(item => (
                  <label key={item.key} className="flex items-center justify-between py-2 cursor-pointer">
                    <span className="text-text-header text-sm">{item.label}</span>
                    <div className="w-9 h-5 rounded-full bg-brand relative">
                      <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white shadow" />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {(section === 'profile' || section === 'privacy' || section === 'keybinds') && (
            <div className="bg-bg-tertiary rounded-lg p-8 text-center">
              <p className="text-text-muted">This section is coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
