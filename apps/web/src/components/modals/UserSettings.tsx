import { useState, useEffect, useRef } from 'react';
import { User, Shield, Bell, Palette, Keyboard, LogOut, X, Mic, Volume2, Video, Camera, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../lib/api';
import type { User as UserType } from '@freecord/types';

interface UserSettingsProps {
  onClose: () => void;
}

type Section = 'account' | 'profile' | 'privacy' | 'notifications' | 'appearance' | 'voice' | 'keybinds';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'My Account', icon: <User size={16} /> },
  { id: 'profile', label: 'Profiles', icon: <User size={16} /> },
  { id: 'privacy', label: 'Privacy & Safety', icon: <Shield size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'voice', label: 'Voice & Video', icon: <Mic size={16} /> },
  { id: 'keybinds', label: 'Keybinds', icon: <Keyboard size={16} /> },
];

const KEYBINDS = [
  { action: 'Upload File', keys: ['Ctrl', 'Shift', 'U'] },
  { action: 'Mark Server Read', keys: ['Escape'] },
  { action: 'Jump to Oldest Unread', keys: ['Shift', 'Escape'] },
  { action: 'Toggle Mute', keys: ['Ctrl', 'Shift', 'M'] },
  { action: 'Toggle Deafen', keys: ['Ctrl', 'Shift', 'D'] },
  { action: 'Open User Settings', keys: ['Ctrl', ','] },
  { action: 'Previous Server', keys: ['Ctrl', 'Alt', '↑'] },
  { action: 'Next Server', keys: ['Ctrl', 'Alt', '↓'] },
  { action: 'Previous Channel', keys: ['Alt', '↑'] },
  { action: 'Next Channel', keys: ['Alt', '↓'] },
  { action: 'Search Messages', keys: ['Ctrl', 'F'] },
  { action: 'Reply to Message', keys: ['R'] },
  { action: 'Edit Last Message', keys: ['↑'] },
  { action: 'Send Message', keys: ['Enter'] },
  { action: 'New Line', keys: ['Shift', 'Enter'] },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-9 h-5 rounded-full relative transition-colors ${value ? 'bg-brand' : 'bg-bg-primary'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  );
}

export function UserSettingsModal({ onClose }: UserSettingsProps) {
  const { user, logout } = useAuthStore();
  const [section, setSection] = useState<Section>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Account form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Profile state
  const [bio, setBio] = useState((user as any)?.bio || '');
  const [bannerColor, setBannerColor] = useState((user as any)?.bannerColor || '#5865f2');
  const [profileSaving, setProfileSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Privacy state
  const [friendRequestsFrom, setFriendRequestsFrom] = useState<'everyone' | 'mutual_guilds' | 'none'>('everyone');
  const [allowDmsFrom, setAllowDmsFrom] = useState<'everyone' | 'mutual_guilds' | 'none'>('everyone');
  const [blockedUsers, setBlockedUsers] = useState<UserType[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  // Voice state
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState('default');
  const [selectedOutput, setSelectedOutput] = useState('default');
  const [selectedVideo, setSelectedVideo] = useState('default');
  const [inputVolume, setInputVolume] = useState(100);
  const [outputVolume, setOutputVolume] = useState(100);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);

  // Notifications state
  const [desktopNotifs, setDesktopNotifs] = useState(false);
  const [notifSounds, setNotifSounds] = useState(true);

  // Load blocked users when privacy tab opens
  useEffect(() => {
    if (section !== 'privacy') return;
    setBlockedLoading(true);
    api.get<any[]>('/api/v1/users/@me/relationships')
      .then(rels => setBlockedUsers(rels.filter((r: any) => r.type === 2).map((r: any) => r.user)))
      .catch(() => {})
      .finally(() => setBlockedLoading(false));
  }, [section]);

  // Load media devices when voice tab opens
  useEffect(() => {
    if (section !== 'voice') return;
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      setInputDevices(devices.filter(d => d.kind === 'audioinput'));
      setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
    }).catch(() => {});
  }, [section]);

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

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setError('');
    try {
      await api.patch('/api/v1/users/@me', { bio, bannerColor });
      setSuccess('Profile saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await api.upload('/api/v1/users/@me/avatar', formData);
      setSuccess('Avatar updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleUnblock = async (userId: string) => {
    try {
      await api.delete(`/api/v1/users/@me/relationships/${userId}`);
      setBlockedUsers(prev => prev.filter(u => u.id !== userId));
    } catch {}
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
            <Avatar userId={user.id} username={user.username} avatarHash={user.avatar} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-text-header text-sm font-medium truncate">{user.username}</p>
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

          {error && <p className="text-danger text-sm mb-4">{error}</p>}
          {success && <p className="text-green-400 text-sm mb-4">{success}</p>}

          {/* Account */}
          {section === 'account' && user && (
            <div className="space-y-6">
              <div className="bg-bg-tertiary rounded-lg p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                    <Avatar userId={user.id} username={user.username} avatarHash={user.avatar} size={80} />
                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <p className="text-white text-xs font-bold text-center">{avatarUploading ? '...' : 'CHANGE'}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text-header">{user.displayName || user.username}</h3>
                    <p className="text-text-muted text-sm">@{user.username}#{user.discriminator}</p>
                  </div>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
              </div>

              <div className="space-y-4">
                <Input label="DISPLAY NAME" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={user.displayName || user.username} />
                <Input label="EMAIL (leave blank to keep current)" value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="new-email@example.com" />
                {(email || newPassword) && (
                  <Input label="CURRENT PASSWORD (required)" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} type="password" placeholder="Enter your current password" />
                )}
                <Input label="NEW PASSWORD (leave blank to keep current)" value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="New password" />
              </div>

              <Button onClick={handleSaveAccount} loading={loading}>Save Changes</Button>
            </div>
          )}

          {/* Profile */}
          {section === 'profile' && user && (
            <div className="space-y-6">
              {/* Preview card */}
              <div className="bg-bg-tertiary rounded-lg overflow-hidden">
                <div className="h-20 relative" style={{ backgroundColor: bannerColor }}>
                  <div className="absolute -bottom-8 left-4">
                    <div className="rounded-full border-4 border-bg-tertiary overflow-hidden">
                      <Avatar userId={user.id} username={user.username} avatarHash={user.avatar} size={64} />
                    </div>
                  </div>
                </div>
                <div className="pt-10 px-4 pb-4">
                  <p className="font-bold text-text-header">{user.displayName || user.username}</p>
                  <p className="text-text-muted text-xs">@{user.username}#{user.discriminator}</p>
                  {bio && <p className="text-text-muted text-sm mt-2 whitespace-pre-wrap">{bio}</p>}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Banner Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={bannerColor} onChange={e => setBannerColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
                    <span className="text-text-muted text-sm font-mono">{bannerColor}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">ABOUT ME</label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    maxLength={190}
                    rows={4}
                    placeholder="Tell others a little bit about yourself..."
                    className="w-full bg-bg-primary rounded px-3 py-2 text-sm text-text-header placeholder-text-muted border border-black/20 outline-none focus:border-brand resize-none"
                  />
                  <p className="text-xs text-text-muted mt-1 text-right">{190 - bio.length} remaining</p>
                </div>
              </div>

              <Button onClick={handleSaveProfile} loading={profileSaving}>Save Profile</Button>
            </div>
          )}

          {/* Privacy & Safety */}
          {section === 'privacy' && (
            <div className="space-y-6">
              <div className="bg-bg-tertiary rounded-lg p-4 space-y-4">
                <h3 className="text-text-header font-semibold">Friend Requests</h3>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Who can send you friend requests?</label>
                  <div className="space-y-2">
                    {([
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'mutual_guilds', label: 'Friends of Friends / Server Members' },
                      { value: 'none', label: 'No One' },
                    ] as const).map(opt => (
                      <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                        <div
                          onClick={() => setFriendRequestsFrom(opt.value)}
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${friendRequestsFrom === opt.value ? 'border-brand bg-brand' : 'border-text-muted'}`}
                        >
                          {friendRequestsFrom === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-text-header text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-bg-tertiary rounded-lg p-4 space-y-3">
                <h3 className="text-text-header font-semibold">Direct Messages</h3>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-text-header text-sm">Allow direct messages from server members</p>
                    <p className="text-text-muted text-xs mt-0.5">When disabled, only friends can DM you</p>
                  </div>
                  <Toggle value={allowDmsFrom !== 'none'} onChange={v => setAllowDmsFrom(v ? 'everyone' : 'none')} />
                </label>
              </div>

              <div className="bg-bg-tertiary rounded-lg p-4">
                <h3 className="text-text-header font-semibold mb-3">Blocked Users</h3>
                {blockedLoading ? (
                  <p className="text-text-muted text-sm">Loading...</p>
                ) : blockedUsers.length === 0 ? (
                  <p className="text-text-muted text-sm">You haven't blocked anyone.</p>
                ) : (
                  <div className="space-y-2">
                    {blockedUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-3 py-1.5">
                        <Avatar userId={u.id} username={u.username} avatarHash={u.avatar} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-text-header text-sm font-medium truncate">{u.username}</p>
                        </div>
                        <button
                          onClick={() => handleUnblock(u.id)}
                          className="text-xs text-text-muted hover:text-white px-2 py-1 rounded border border-white/20 hover:border-white/40 transition-colors"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notifications */}
          {section === 'notifications' && (
            <div className="space-y-4">
              <div className="bg-bg-tertiary rounded-lg p-4 space-y-3">
                <h3 className="text-text-header font-semibold mb-1">Desktop Notifications</h3>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-text-header text-sm">Enable Desktop Notifications</span>
                  <Toggle value={desktopNotifs} onChange={v => {
                    if (v && 'Notification' in window) Notification.requestPermission();
                    setDesktopNotifs(v);
                  }} />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-text-header text-sm">Enable Notification Sounds</span>
                  <Toggle value={notifSounds} onChange={setNotifSounds} />
                </label>
              </div>
            </div>
          )}

          {/* Appearance */}
          {section === 'appearance' && (
            <div className="space-y-6">
              <div className="bg-bg-tertiary rounded-lg p-4">
                <h3 className="text-text-header font-semibold mb-3">Theme</h3>
                <div className="flex gap-3">
                  {(['Dark', 'Light', 'Amoled'] as const).map(theme => (
                    <button key={theme} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${theme === 'Dark' ? 'bg-brand text-white' : 'bg-bg-secondary text-text-muted hover:text-text-header'}`}>
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-bg-tertiary rounded-lg p-4">
                <h3 className="text-text-header font-semibold mb-1">Message Display</h3>
                <p className="text-text-muted text-sm mb-3">Choose how messages look</p>
                <div className="flex gap-3">
                  {(['Cozy', 'Compact'] as const).map(mode => (
                    <button key={mode} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${mode === 'Cozy' ? 'bg-brand text-white' : 'bg-bg-secondary text-text-muted hover:text-text-header'}`}>
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Voice & Video */}
          {section === 'voice' && (
            <div className="space-y-6">
              <div className="bg-bg-tertiary rounded-lg p-4 space-y-4">
                <h3 className="text-text-header font-semibold flex items-center gap-2"><Mic size={16} /> Input Device</h3>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Microphone</label>
                  <select
                    value={selectedInput}
                    onChange={e => setSelectedInput(e.target.value)}
                    className="w-full bg-bg-primary border border-black/20 rounded px-3 py-2 text-sm text-text-header outline-none focus:border-brand"
                  >
                    <option value="default">Default</option>
                    {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0,8)}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Input Volume — {inputVolume}%</label>
                  <input type="range" min={0} max={200} value={inputVolume} onChange={e => setInputVolume(Number(e.target.value))}
                    className="w-full accent-brand" />
                </div>
                <div className="space-y-2 pt-1">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-text-header text-sm">Noise Suppression</span>
                    <Toggle value={noiseSuppression} onChange={setNoiseSuppression} />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-text-header text-sm">Echo Cancellation</span>
                    <Toggle value={echoCancellation} onChange={setEchoCancellation} />
                  </label>
                </div>
              </div>

              <div className="bg-bg-tertiary rounded-lg p-4 space-y-4">
                <h3 className="text-text-header font-semibold flex items-center gap-2"><Volume2 size={16} /> Output Device</h3>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Speaker / Headset</label>
                  <select
                    value={selectedOutput}
                    onChange={e => setSelectedOutput(e.target.value)}
                    className="w-full bg-bg-primary border border-black/20 rounded px-3 py-2 text-sm text-text-header outline-none focus:border-brand"
                  >
                    <option value="default">Default</option>
                    {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,8)}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Output Volume — {outputVolume}%</label>
                  <input type="range" min={0} max={200} value={outputVolume} onChange={e => setOutputVolume(Number(e.target.value))}
                    className="w-full accent-brand" />
                </div>
              </div>

              <div className="bg-bg-tertiary rounded-lg p-4 space-y-4">
                <h3 className="text-text-header font-semibold flex items-center gap-2"><Camera size={16} /> Video</h3>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Camera</label>
                  <select
                    value={selectedVideo}
                    onChange={e => setSelectedVideo(e.target.value)}
                    className="w-full bg-bg-primary border border-black/20 rounded px-3 py-2 text-sm text-text-header outline-none focus:border-brand"
                  >
                    <option value="default">Default</option>
                    {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0,8)}`}</option>)}
                  </select>
                </div>
                {videoDevices.length === 0 && (
                  <p className="text-text-muted text-xs">No camera detected. Allow browser access to see available devices.</p>
                )}
              </div>
            </div>
          )}

          {/* Keybinds */}
          {section === 'keybinds' && (
            <div className="space-y-4">
              <p className="text-text-muted text-sm">Keyboard shortcuts available in FreeCord.</p>
              <div className="bg-bg-tertiary rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/20">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wide">Action</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wide">Shortcut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KEYBINDS.map((kb, i) => (
                      <tr key={i} className="border-b border-black/10 hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 text-text-header">{kb.action}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {kb.keys.map((k, ki) => (
                              <span key={ki}>
                                <kbd className="px-1.5 py-0.5 bg-bg-primary rounded text-xs font-mono text-text-header border border-white/10">{k}</kbd>
                                {ki < kb.keys.length - 1 && <span className="text-text-muted mx-0.5 text-xs">+</span>}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
