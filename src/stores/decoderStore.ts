import { create } from 'zustand';

export interface DecoderStep {
  id: string;
  sourceStepId: string;
  operationType: 'decode' | 'encode' | 'hash';
  format: string;
  label: string;
  color: string;
  output: string;
  viewMode: 'text' | 'hex';
}

export interface DecoderState {
  inputText: string;
  inputViewMode: 'text' | 'hex';
  setInputViewMode: (mode: 'text' | 'hex') => void;
  setInputText: (text: string) => void;
  steps: DecoderStep[];
  setSteps: (steps: DecoderStep[]) => void;
  addStep: (step: DecoderStep) => void;
  updateStepOutput: (id: string, output: string) => void;
  updateStepViewMode: (id: string, mode: 'text' | 'hex') => void;
  removeStep: (id: string) => void;
  clearCascade: () => void;
  sendToDecoder: (text: string) => void;
}

export const useDecoderStore = create<DecoderState>((set) => ({
  inputText: 'admin%27%20OR%201%3D1--',
  inputViewMode: 'text',
  setInputViewMode: (inputViewMode) => set({ inputViewMode }),
  setInputText: (inputText) => set({ inputText }),
  steps: [],
  setSteps: (steps) => set({ steps }),
  addStep: (step) => set((s) => ({ steps: [...s.steps, step] })),
  updateStepOutput: (id, output) =>
    set((s) => ({
      steps: s.steps.map((st) => (st.id === id ? { ...st, output } : st)),
    })),
  updateStepViewMode: (id, viewMode) =>
    set((s) => ({
      steps: s.steps.map((st) => (st.id === id ? { ...st, viewMode } : st)),
    })),
  removeStep: (id) =>
    set((s) => ({
      steps: s.steps.filter((st) => st.id !== id),
    })),
  clearCascade: () => set({ steps: [] }),
  sendToDecoder: (text) => set({ inputText: text }),
}));
