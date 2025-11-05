import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle, Info } from "lucide-react";
import { useFilterStore } from "@/stores/filterStore";
import { apiClient, OverviewData, TimeseriesDataPoint, RankingUF, ForecastDataPoint } from "@/lib/api";
import FilterSection from "@/components/dashboard/FilterSection";
import KPICards from "@/components/dashboard/KPICards";
import TimeseriesChart from "@/components/dashboard/TimeseriesChart";
import BrazilMap from "@/components/dashboard/BrazilMap";
import ForecastChart from "@/components/dashboard/ForecastChart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { motion } from "framer-motion";

const Dashboard = () => {
  const { ano, mes, uf, insumo, getAPIParams } = useFilterStore();
  
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [timeseriesData, setTimeseriesData] = useState<TimeseriesDataPoint[]>([]);
  const [rankingData, setRankingData] = useState<RankingUF[]>([]);
  const [forecastData, setForecastData] = useState<ForecastDataPoint[]>([]);
  
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingTimeseries, setLoadingTimeseries] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const params = getAPIParams();
      setError(null);

      // Fetch Overview
      setLoadingOverview(true);
      try {
        const overview = await apiClient.getOverview(params);
        setOverviewData(overview);
      } catch (err) {
        setError("Erro ao carregar dados. Verifique se o backend está rodando.");
        console.error(err);
      } finally {
        setLoadingOverview(false);
      }

      // Fetch Timeseries
      setLoadingTimeseries(true);
      try {
        const timeseries = await apiClient.getTimeseries(params);
        setTimeseriesData(timeseries);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingTimeseries(false);
      }

      // Fetch Ranking
      setLoadingRanking(true);
      try {
        const ranking = await apiClient.getRankingUFs(params);
        setRankingData(ranking);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingRanking(false);
      }

      // Fetch Forecast
      setLoadingForecast(true);
      try {
        const forecast = await apiClient.getForecast(params);
        setForecastData(forecast);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingForecast(false);
      }
    };

    fetchData();
  }, [ano, mes, uf, insumo]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Vacina Brasil</h1>
          </Link>
          <nav className="flex gap-4 items-center">
            <Link to="/sobre" className="text-muted-foreground hover:text-foreground transition-colors">
              Sobre
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard Nacional</h1>
          <p className="text-muted-foreground">
            Acompanhe os dados de distribuição e aplicação de vacinas em tempo real
          </p>
        </motion.div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Configuração do Backend</AlertTitle>
          <AlertDescription>
            Este dashboard consome dados de uma API FastAPI. Configure a variável de ambiente{" "}
            <code className="bg-muted px-1 py-0.5 rounded">VITE_BASE_API_URL</code> para apontar para seu backend.
          </AlertDescription>
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <FilterSection />

        {/* KPIs */}
        <KPICards data={overviewData} loading={loadingOverview} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeseriesChart data={timeseriesData} loading={loadingTimeseries} />
          <BrazilMap data={rankingData} loading={loadingRanking} />
        </div>

        {/* Forecast */}
        <ForecastChart data={forecastData} loading={loadingForecast} />
      </main>
    </div>
  );
};

export default Dashboard;
