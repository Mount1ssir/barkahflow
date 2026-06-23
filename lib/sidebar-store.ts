'use client'

import { create } from 'zustand'

interface SidebarStore {
  expanded: boolean
  toggle: () => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  expanded: false,
  toggle: () => set((state) => ({ expanded: !state.expanded })),
}))