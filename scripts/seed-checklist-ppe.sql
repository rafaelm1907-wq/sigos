WITH checklist_items(code, name, category) AS (
  VALUES
    ('CHECKLIST-PPE-01', 'CAPACETE DE SEGURANÇA COM JUGULAR', 'Proteção da cabeça'),
    ('CHECKLIST-PPE-02', 'ÓCULOS DE SEGURANÇA', 'Proteção dos olhos'),
    ('CHECKLIST-PPE-03', 'LUVAS DE PROTEÇÃO CONTRA RISCOS MECÂNICOS', 'Proteção das mãos'),
    ('CHECKLIST-PPE-04', 'CALÇADO DE SEGURANÇA', 'Calçado'),
    ('CHECKLIST-PPE-05', 'COLETE/VESTIMENTA DE ALTA VISIBILIDADE, QUANDO APLICÁVEL', 'Vestimenta'),
    ('CHECKLIST-PPE-06', 'PROTETOR AURICULAR, QUANDO HOUVER EXPOSIÇÃO A RUÍDO', 'Proteção auditiva'),
    ('CHECKLIST-PPE-07', 'CINTURÃO DE SEGURANÇA TIPO PARAQUEDISTA - TRABALHO EM ALTURA', 'Trabalho em altura'),
    ('CHECKLIST-PPE-08', 'TALABARTE DUPLO COM ABSORVEDOR DE ENERGIA, QUANDO APLICÁVEL', 'Trabalho em altura'),
    ('CHECKLIST-PPE-09', 'TRAVA-QUEDAS, QUANDO APLICÁVEL', 'Trabalho em altura'),
    ('CHECKLIST-PPE-10', 'MOSQUETÕES/CONECTORES SEM DEFORMAÇÕES OU DANOS', 'Trabalho em altura'),
    ('CHECKLIST-PPE-11', 'LUVA ISOLANTE ADEQUADA AO RISCO ELÉTRICO, QUANDO APLICÁVEL', 'Proteção das mãos'),
    ('CHECKLIST-PPE-12', 'LUVA DE COBERTURA DA LUVA ISOLANTE, QUANDO APLICÁVEL', 'Proteção das mãos'),
    ('CHECKLIST-PPE-13', 'VESTIMENTA ADEQUADA AO RISCO ELÉTRICO, QUANDO APLICÁVEL', 'Risco elétrico'),
    ('CHECKLIST-PPE-14', 'PROTETOR FACIAL, QUANDO HOUVER RISCO DE ARCO/PROJEÇÃO', 'Proteção facial')
)
INSERT INTO ppe_items (code, name, ca, category, stock_quantity, minimum_stock, active)
SELECT item.code, item.name, NULL, item.category, 0, 0, TRUE
FROM checklist_items item
WHERE NOT EXISTS (
  SELECT 1
  FROM ppe_items existing
  WHERE LOWER(TRIM(existing.name)) = LOWER(TRIM(item.name))
);
