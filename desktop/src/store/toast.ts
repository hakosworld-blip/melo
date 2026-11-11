"use client";

import { create } from "zustand";

export interface ToastItem {
  id: number;
  message: string;
  tone: "neutral" | "success" | "error";
  action?: { label: string; run: () => void };
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone?: ToastItem["tone"], action?: ToastItem["action"]) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = "neutral", action) => {
    const id = ++counter;
    set((state) => ({ items: [...state.items.slice(-2), { id, message, tone, action }] }));
    setTimeout(() => {
      set((state) => ({ items: state.items.filter((t) => t.id !== id) }));
    }, 4200);
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((t) => t.id !== id) })),
}));

export function toast(message: string, tone: ToastItem["tone"] = "neutral", action?: ToastItem["action"]) {
  useToasts.getState().push(message, tone, action);
}
