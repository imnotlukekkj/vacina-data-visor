# Backend helpers — mapeamento TX_INSUMO → vacina_normalizada

Arquivos criados:

- `mappings.json`: regras iniciais (regex + prioridade) para mapear `TX_INSUMO` para um rótulo `vacina_normalizada`.
- `insumo_mappings_seed.sql`: SQL para criar a tabela `insumo_mappings` e inserir o seed inicial.
- `etl_normalize.py`: script Python que aplica as regras sobre um arquivo JSON com registros e gera `tx_insumo_norm`.

Como usar (PowerShell):

```powershell
# Normalizar um arquivo data.json para normalized.json
python backend/etl_normalize.py --input data.json --output normalized.json

# Para aplicar no banco (Supabase/Postgres):
# 1) Rode `insumo_mappings_seed.sql` contra seu banco (psql ou via Supabase SQL Editor).
# 2) Use o script ETL para popular a coluna `tx_insumo_norm` ou executar atualizações via SQL
#    (ex.: UPDATE distribuicao SET tx_insumo_norm = '...' WHERE tx_insumo ILIKE '%...%')
```

Observações:
- As regras iniciais são básicas e servem como ponto de partida. Após rodar o ETL com uma amostra maior
  você provavelmente precisará ajustar `mappings.json` (novos padrões ou prioridades).
