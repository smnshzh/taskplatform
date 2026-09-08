"use client";

import { create } from "zustand";

export type ViewKey =
  | "overview"
  | "kanban"
  | "list"
  | "workflow"
  | "scheduler"
  | "referred"
  | "mytasks"
  | "members"
  | "groups"
  | "access-groups"
  | "bale-management"
  | "admin"
  | "trash"
  | "donetasks";

export type CurrentMember = {
  id: string;
  name: string;
  handle: string;
  role: string;
  companyId: string | null;
  companyName: string | null;
  companySlug: string | null;
  selectedSolutionKey: string | null;
  groupId: string | null;
  groupName: string | null;
  supervisorId: string | null;
  mustChangePassword: boolean;
  permissions: string[];
  accessGroups: { id: string; name: string }[];
};

interface TMState {
  member: CurrentMember | null;
  authLoading: boolean;
  setMember: (m: CurrentMember | null) => void;
  setAuthLoading: (v: boolean) => void;
  view: ViewKey;
  setView: (v: ViewKey) => void;
  taskVersion: number;
  bumpTaskVersion: () => void;
}

export const useTMStore = create<TMState>((set) => ({
  member: null,
  authLoading: true,
  setMember: (member) => set({ member }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  view: "overview",
  setView: (view) => set({ view }),
  taskVersion: 0,
  bumpTaskVersion: () => set((s) => ({ taskVersion: s.taskVersion + 1 })),
}));
