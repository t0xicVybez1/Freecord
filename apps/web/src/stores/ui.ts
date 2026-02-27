import { create } from 'zustand'

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

interface UIState {
  modals: ModalState[]
  contextMenu: { x: number; y: number; items: ContextMenuItem[] } | null
  activeMemberListPanel: boolean
  settingsSection: string
  openModal: (modal: ModalState) => void
  closeModal: () => void
  closeAllModals: () => void
  openContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void
  closeContextMenu: () => void
  toggleMemberList: () => void
  setSettingsSection: (section: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  modals: [],
  contextMenu: null,
  activeMemberListPanel: true,
  settingsSection: 'my-account',

  openModal: (modal) => set(s => ({ modals: [...s.modals, modal] })),
  closeModal: () => set(s => ({ modals: s.modals.slice(0, -1) })),
  closeAllModals: () => set({ modals: [] }),

  openContextMenu: (x, y, items) => set({ contextMenu: { x, y, items } }),
  closeContextMenu: () => set({ contextMenu: null }),

  toggleMemberList: () => set(s => ({ activeMemberListPanel: !s.activeMemberListPanel })),
  setSettingsSection: (section) => set({ settingsSection: section }),
}))
