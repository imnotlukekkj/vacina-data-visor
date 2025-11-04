import { create } from "zustand";

export interface FilterState {
  ano: string;
  mes: string;
  uf: string;
  insumo: string; // No UI chamado "insumo", mas enviado como "fabricante" na API
  
  setAno: (ano: string) => void;
  setMes: (mes: string) => void;
  setUF: (uf: string) => void;
  setInsumo: (insumo: string) => void;
  clearFilters: () => void;
  
  // Converte insumo para fabricante para a API
  getAPIParams: () => {
    ano?: string;
    mes?: string;
    uf?: string;
    fabricante?: string;
  };
}

export const useFilterStore = create<FilterState>((set, get) => ({
  ano: "",
  mes: "",
  uf: "",
  insumo: "",
  
  setAno: (ano) => set({ ano }),
  setMes: (mes) => set({ mes }),
  setUF: (uf) => set({ uf }),
  setInsumo: (insumo) => set({ insumo }),
  
  clearFilters: () => set({ ano: "", mes: "", uf: "", insumo: "" }),
  
  getAPIParams: () => {
    const state = get();
    const params: any = {};
    if (state.ano) params.ano = state.ano;
    if (state.mes) params.mes = state.mes;
    if (state.uf) params.uf = state.uf;
    if (state.insumo) params.fabricante = state.insumo; // Conversão insumo → fabricante
    return params;
  },
}));
