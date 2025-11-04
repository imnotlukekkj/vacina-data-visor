import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

interface TimeseriesChartProps {
  data: Array<{
    data: string;
    doses_distribuidas: number;
    doses_aplicadas: number;
    doses_estoque: number;
  }>;
  loading: boolean;
}

const TimeseriesChart = ({ data, loading }: TimeseriesChartProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Série Temporal</CardTitle>
          <CardDescription>Distribuição ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando dados...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Série Temporal</CardTitle>
          <CardDescription>Distribuição ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Série Temporal</CardTitle>
          <CardDescription>Evolução de doses distribuídas, aplicadas e em estoque</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
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
              <Line 
                type="monotone" 
                dataKey="doses_distribuidas" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Distribuídas"
                dot={{ fill: "hsl(var(--primary))" }}
              />
              <Line 
                type="monotone" 
                dataKey="doses_aplicadas" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                name="Aplicadas"
                dot={{ fill: "hsl(var(--secondary))" }}
              />
              <Line 
                type="monotone" 
                dataKey="doses_estoque" 
                stroke="hsl(var(--accent))" 
                strokeWidth={2}
                name="Estoque"
                dot={{ fill: "hsl(var(--accent))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TimeseriesChart;
