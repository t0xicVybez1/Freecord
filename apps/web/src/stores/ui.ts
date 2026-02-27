import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

export interface ModalState {
  type: string
  data?: unknown
}

export type AppTheme = 'dark' | 'light' | 'amoled'

interface UIState {
  modals: ModalState[]
  contextMenu: { x: number; y: number; items: ContextMenuItem[] } | null
  activeMemberListPanel: boolean
  settingsSection: string
  theme: AppTheme
  openModal: (modal: ModalState) => void
  closeModal: () => void
  closeAllModals: () => void
  openContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void
  closeContextMenu: () => void
  toggleMemberList: () => void
  setSettingsSection: (section: string) => void
  setTheme: (theme: AppTheme) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      modals: [],
      contextMenu: null,
      activeMemberListPanel: true,
      settingsSection: 'my-account',
      theme: 'dark',

      openModal: (modal) => set(s => ({ modals: [...s.modals, modal] })),
      closeModal: () => set(s => ({ modals: s.modals.slice(0, -1) })),
      closeAllModals: () => set({ modals: [] }),

      openContextMenu: (x, y, items) => set({ contextMenu: { x, y, items } }),
      closeContextMenu: () => set({ contextMenu: null }),

      toggleMemberList: () => set(s => ({ activeMemberListPanel: !s.activeMemberListPanel })),
      setSettingsSection: (section) => set({ settingsSection: section }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'freecord-ui',
      partialize: (s) => ({ theme: s.theme, activeMemberListPanel: s.activeMemberListPanel }),
    }
  )
)
