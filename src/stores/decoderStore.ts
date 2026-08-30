import { create } from 'zustand';

export interface DecoderState {
  inputText: string;
  setInputText: (text: string) => void;
  sendToDecoder: (text: string) => void;
}

export const useDecoderStore = create<DecoderState>((set) => ({
  inputText: 'admin%27%20OR%201%3D1--',
  setInputText: (inputText) => set({ inputText }),
  sendToDecoder: (text) => set({ inputText: text }),
}));
