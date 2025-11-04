import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";
import { useFilterStore } from "@/stores/filterStore";

const ANOS = ["2020", "2021", "2022", "2023", "2024"];
const MESES = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];
const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", 
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", 
  "SP", "SE", "TO"
];
const INSUMOS = ["Pfizer", "CoronaVac", "AstraZeneca", "Janssen", "Moderna"];

const FilterSection = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { ano, mes, uf, insumo, setAno, setMes, setUF, setInsumo, clearFilters } = useFilterStore();

  // Sincroniza URL com store
  useEffect(() => {
    const anoParam = searchParams.get("ano");
    const mesParam = searchParams.get("mes");
    const ufParam = searchParams.get("uf");
    const insumoParam = searchParams.get("insumo");

    if (anoParam) setAno(anoParam);
    if (mesParam) setMes(mesParam);
    if (ufParam) setUF(ufParam);
    if (insumoParam) setInsumo(insumoParam);
  }, []);

  // Atualiza URL quando filtros mudam
  useEffect(() => {
    const params = new URLSearchParams();
    if (ano) params.set("ano", ano);
    if (mes) params.set("mes", mes);
    if (uf) params.set("uf", uf);
    if (insumo) params.set("insumo", insumo);
    setSearchParams(params);
  }, [ano, mes, uf, insumo, setSearchParams]);

  const handleClearFilters = () => {
    clearFilters();
    setSearchParams(new URLSearchParams());
  };

  const hasFilters = ano || mes || uf || insumo;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ano">Ano</Label>
            <Select value={ano || "all"} onValueChange={(v) => setAno(v === "all" ? "" : v)}>
              <SelectTrigger id="ano">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ANOS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mes">Mês</Label>
            <Select value={mes || "all"} onValueChange={(v) => setMes(v === "all" ? "" : v)}>
              <SelectTrigger id="mes">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MESES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="uf">UF</Label>
            <Select value={uf || "all"} onValueChange={(v) => setUF(v === "all" ? "" : v)}>
              <SelectTrigger id="uf">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {UFS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="insumo">Insumo</Label>
            <Select value={insumo || "all"} onValueChange={(v) => setInsumo(v === "all" ? "" : v)}>
              <SelectTrigger id="insumo">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {INSUMOS.map((i) => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasFilters && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              <X className="mr-2 h-4 w-4" />
              Limpar Filtros
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FilterSection;
