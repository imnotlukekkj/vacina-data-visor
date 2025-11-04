import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart } from "recharts";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

interface ForecastChartProps {
  data: Array<{
    data: string;
    doses_previstas: number;
    intervalo_inferior?: number;
    intervalo_superior?: number;
  }>;
  loading: boolean;
}

const ForecastChart = ({ data, loading }: ForecastChartProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Previsão de Distribuição</CardTitle>
          </div>
          <CardDescription>Projeção baseada em dados históricos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Calculando previsão...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Previsão de Distribuição</CardTitle>
          </div>
          <CardDescription>Projeção baseada em dados históricos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Dados insuficientes para gerar previsão</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Previsão de Distribuição</CardTitle>
          </div>
          <CardDescription>Projeção de doses distribuídas baseada em dados históricos</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="data" 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
              {data[0]?.intervalo_inferior !== undefined && (
                <Area
                  type="monotone"
                  dataKey="intervalo_superior"
                  fill="hsl(var(--primary) / 0.1)"
                  stroke="none"
                  name="Intervalo de Confiança"
                />
              )}
              {data[0]?.intervalo_inferior !== undefined && (
                <Area
                  type="monotone"
                  dataKey="intervalo_inferior"
                  fill="hsl(var(--background))"
                  stroke="none"
                />
              )}
              <Line 
                type="monotone" 
                dataKey="doses_previstas" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                strokeDasharray="5 5"
                name="Previsão"
                dot={{ fill: "hsl(var(--primary))", r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ForecastChart;
