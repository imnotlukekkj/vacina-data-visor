import React, { useMemo } from "react";
import parsePtNumber from "@/lib/number";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from "recharts";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

interface ComparisonDatum {
  ano: number | string;
  quantidade: number | null | string;
  tipo?: string;
}

interface ComparisonChartProps {
  // 'data' can be either the raw comparison array or the full response object
  // { insumo, projecao_unidade, dados_comparacao }
  data: any;
  loading: boolean;
}

const ComparisonChart = ({ data, loading }: ComparisonChartProps) => {
  const numberFmt = useMemo(() => new Intl.NumberFormat("pt-BR"), []);

  // extract payload and detect projection unit
  const { comp, projecaoUnidade } = useMemo(() => {
    if (!data) return { comp: [] as ComparisonDatum[], projecaoUnidade: "desconhecida" };

    // data may be an object { projecao_unidade, dados_comparacao } or an array
    const projUnit = (data && data.projecao_unidade) || "desconhecida";
    const arr = Array.isArray(data) ? data : data.dados_comparacao || [];
    const mapped = arr
      .map((d: any) => ({ ano: Number(d.ano), quantidade: d.quantidade, tipo: d.tipo }))
      .sort((a: any, b: any) => Number(a.ano) - Number(b.ano));
    return { comp: mapped as ComparisonDatum[], projecaoUnidade: String(projUnit) };
  }, [data]);

  const hasAnyValue = useMemo(() => comp.some((d) => d.quantidade !== null && d.quantidade !== undefined && Number(d.quantidade) !== 0), [comp]);

  // normalize quantidade to number|null. Accept numbers or pt-BR formatted strings like "9.742.075"
  // If projecao_unidade === 'mensal', annualize the 2025 projection by *12
  const barData = useMemo(() => {
    const list = comp.map((d) => ({ ano: String(d.ano), quantidade: parsePtNumber(d.quantidade), tipo: d.tipo }));
    if (String(projecaoUnidade).toLowerCase() === "mensal") {
      return list.map((item) => {
        if (String(item.ano) === "2025" && item.quantidade !== null && item.quantidade !== undefined) {
          // multiply by 12 to annualize
          return { ...item, quantidade: Number(item.quantidade) * 12, __annualized: true };
        }
        return item;
      });
    }
    return list;
  }, [comp, projecaoUnidade]);

  const hasAnnualized = useMemo(() => barData.some((b) => (b as any).__annualized), [barData]);

  // compute Y axis maximum (10% headroom) — ignore nulls
  const maxValue = useMemo(() => {
    const vals = barData
      .map((b) => (b.quantidade === null || b.quantidade === undefined ? NaN : Number(b.quantidade)))
      .filter((n) => Number.isFinite(n));
    if (!vals.length) return 1;
    const m = Math.max(...vals);
    return Number.isFinite(m) ? m : 1;
  }, [barData]);

  // Use exact maximum (no extra headroom) so the largest bar reaches the top of the chart area
  // This makes the comparison visually strict (2024 will fill to the top).
  const yMax = useMemo(() => {
    const candidate = Number.isFinite(maxValue) ? Math.ceil(maxValue) : 1;
    return candidate <= 0 ? 1 : candidate;
  }, [maxValue]);

  // removed debug logging to keep console clean in production/dev

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Previsão de Distribuição</CardTitle>
          </div>
          <CardDescription>Comparação 2024 vs 2025</CardDescription>
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
          <CardDescription>Comparação 2024 vs 2025</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Dados insuficientes para gerar previsão</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasAnyValue) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Previsão de Distribuição</CardTitle>
          </div>
          <CardDescription>Comparação 2024 vs 2025</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Dados insuficientes para gerar previsão</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  

  // compact formatter for ticks and labels (kept numeric, only returns string for display)
  const compactFmt = (v: any) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    // Use pt-BR integer formatting for consistency (no fractional digits)
    return numberFmt.format(Math.round(n));
  };

  // color mapping: historico (2024) -> neutral/brand muted; projecao (2025) -> green #10b981
  const colorFor = (tipo?: string, ano?: number | string) => {
    const t = (tipo || "").toString().toLowerCase();
    const a = Number(ano);
    if (t.includes("proje") || a === 2025) return "#10b981"; // green-600 (highlight projection)
    // default: neutral gray for historical
    return "#6b7280"; // gray-500
  };

  // Helper to render label text color matching bar color (so 2025 labels appear green)
  const renderTopLabel = (props: any) => {
    const { x, y, value, index } = props;
    const entry = barData[index];
    const color = colorFor(entry.tipo, entry.ano);
    const display = value === null || value === undefined ? "—" : compactFmt(Number(value));
    const withAsterisk = entry && (entry as any).__annualized ? `${display}*` : display;
    return (
      <text x={x} y={y - 6} fill={color} fontSize={12} fontWeight={600} textAnchor="middle">
        {withAsterisk}
      </text>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Previsão de Distribuição</CardTitle>
          </div>
          <CardDescription>Comparação 2024 (histórico) vs 2025 (projeção)</CardDescription>
          <div className="mt-1 text-xs text-muted-foreground">
            Nota: 2024 representa o total anual; 2025 é uma projeção (pode representar média ou estimativa).
            {projecaoUnidade === 'mensal' && (
              <span> A projeção de 2025 foi anualizada (multiplicada por 12) para comparação direta.</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <div className="text-sm text-muted-foreground">Valores nulos indicam dados insuficientes para gerar previsão.</div>
            {/* Legend */}
            <div className="mt-2 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded" style={{ background: "#6b7280" }} />
                <span className="text-muted-foreground">Distribuição Histórica (2024)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded" style={{ background: "#10b981" }} />
                <span className="text-muted-foreground">Projeção (2025)</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={360}>
            {/* default layout (horizontal) draws vertical bars; ensure Y domain starts at 0 and goes to a bit above max */}
            {/* increase left margin so long tick labels (e.g. millions) don't get truncated */}
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="ano" tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                domain={[0, yMax]}
                tickFormatter={(v: any) => {
                  const n = Number(v);
                  if (!Number.isFinite(n)) return String(v);
                  return numberFmt.format(Math.round(n));
                }}
              />
              <Tooltip
                formatter={(value: any) => (value === null || value === undefined ? "—" : numberFmt.format(Number(value)))}
                labelFormatter={(label) => `Ano ${label}`}
                content={(props: any) => {
                  // custom content to show unit hints and an annualization note when applicable
                  const { payload, label, active } = props;
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as any;
                  const v = item.quantidade;
                  const tipo = item.tipo || (String(label) === '2025' ? 'projeção' : 'historico');
                  return (
                    <div style={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12, color: 'hsl(var(--foreground))', minWidth: 160 }}>
                      <div className="font-medium mb-2">Ano {label} {item && item.__annualized ? <span className="text-xs text-muted-foreground">(anualizado)</span> : null}</div>
                      <div className="text-sm text-muted-foreground">{tipo === 'projeção' ? 'Projeção (pode ser média/estimativa)' : 'Distribuição histórica (total)'}</div>
                      <div className="mt-2 font-semibold" style={{ color: colorFor(item.tipo, item.ano) }}>{v === null || v === undefined ? '—' : numberFmt.format(Math.round(Number(v)))}</div>
                                      <div className="text-xs text-muted-foreground mt-2">Dica: 2024 mostra o total anual; 2025 pode ser uma projeção baseada em média histórica.</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="quantidade" name="Quantidade" isAnimationActive={false} minPointSize={5} stroke="none">
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colorFor(entry.tipo, entry.ano)} />
                ))}
                {/* custom top label rendering to match bar color */}
                <LabelList dataKey="quantidade" position="top" content={renderTopLabel as any} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {hasAnnualized && (
            <div className="mt-2 text-xs text-muted-foreground">* O valor da Projeção (2025) foi anualizado (multiplicado por 12) para ser diretamente comparável ao Total de 2024.</div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ComparisonChart;
