-- Cria tabela de mapeamentos para normalização de TX_INSUMO
CREATE TABLE IF NOT EXISTS insumo_mappings (
  id SERIAL PRIMARY KEY,
  vacina_normalizada TEXT NOT NULL,
  pattern TEXT NOT NULL,
  pattern_type TEXT NOT NULL DEFAULT 'regex',
  priority INT NOT NULL DEFAULT 100
);

-- Seed inicial com os mapeamentos gerados a partir dos exemplos
INSERT INTO insumo_mappings (vacina_normalizada, pattern, pattern_type, priority)
VALUES
  ('Poliomielite', 'POLIOMIELITE', 'regex', 10),
  ('BCG', 'BCG', 'regex', 10),
  ('Rotavírus', 'ROTAVIRUS|ROTAVÍRUS', 'regex', 10),
  ('Pneumocócica Conjugada 13 Valente', 'PNEUMOCOCICA|13 VALENTE|13-VALENTE', 'regex', 10),
  ('Hepatite B', 'HEPATITE\\s*\"?B\"?|HEPATITE\\s+B', 'regex', 10)
ON CONFLICT DO NOTHING;

-- Opcional: adicionar coluna normalizada à tabela principal (ajuste o nome da tabela se necessário)
-- ALTER TABLE distribuicao ADD COLUMN IF NOT EXISTS tx_insumo_norm TEXT;
