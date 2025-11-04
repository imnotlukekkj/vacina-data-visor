import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Package, TrendingUp, Syringe } from "lucide-react";
import { motion } from "framer-motion";

interface KPICardsProps {
  data: {
    total_doses: number;
    total_aplicadas: number;
    total_estoque: number;
    taxa_aplicacao: number;
  } | null;
  loading: boolean;
}

const KPICards = ({ data, loading }: KPICardsProps) => {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("pt-BR").format(num);
  };

  const kpis = [
    {
      title: "Doses Distribuídas",
      value: data?.total_doses || 0,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Doses Aplicadas",
      value: data?.total_aplicadas || 0,
      icon: Syringe,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      title: "Doses em Estoque",
      value: data?.total_estoque || 0,
      icon: Activity,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Taxa de Aplicação",
      value: data?.taxa_aplicacao || 0,
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
      isPercentage: true,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-24"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-32 mb-2"></div>
              <div className="h-10 bg-muted rounded-full w-10"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => (
        <motion.div
          key={kpi.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    {kpi.isPercentage 
                      ? `${kpi.value.toFixed(1)}%` 
                      : formatNumber(kpi.value)}
                  </p>
                </div>
                <div className={`${kpi.bgColor} p-3 rounded-full`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default KPICards;
