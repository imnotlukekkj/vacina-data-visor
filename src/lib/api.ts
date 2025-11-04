// API Client para comunicação com backend FastAPI

const BASE_API_URL = import.meta.env.VITE_BASE_API_URL || "http://localhost:8000";

export interface OverviewData {
  total_doses: number;
  periodo?: string;
}

export interface TimeseriesDataPoint {
  data: string;
  doses_distribuidas: number;
}

export interface RankingUF {
  uf: string;
  sigla: string;
  doses_distribuidas: number;
}

export interface ForecastDataPoint {
  data: string;
  doses_previstas: number;
  intervalo_inferior?: number;
  intervalo_superior?: number;
}

export interface FilterParams {
  ano?: string;
  mes?: string;
  uf?: string;
  fabricante?: string;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private buildURL(endpoint: string, params?: FilterParams): string {
    const url = new URL(endpoint, this.baseURL);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  async getOverview(params?: FilterParams): Promise<OverviewData> {
    const url = this.buildURL("/overview", params);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ao buscar overview: ${response.statusText}`);
    }
    return response.json();
  }

  async getTimeseries(params?: FilterParams): Promise<TimeseriesDataPoint[]> {
    const url = this.buildURL("/timeseries", params);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ao buscar série temporal: ${response.statusText}`);
    }
    return response.json();
  }

  async getRankingUFs(params?: FilterParams): Promise<RankingUF[]> {
    const url = this.buildURL("/ranking/ufs", params);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ao buscar ranking: ${response.statusText}`);
    }
    return response.json();
  }

  async getForecast(params?: FilterParams): Promise<ForecastDataPoint[]> {
    const url = this.buildURL("/forecast", params);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ao buscar previsão: ${response.statusText}`);
    }
    return response.json();
  }
}

export const apiClient = new APIClient(BASE_API_URL);
