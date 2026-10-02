# CONVENTIONS.md — Padrão de código e Git

> Combinado entre os membros do squad antes da Sprint 1. Vale para código escrito por pessoas e por IA.

## 1. Nomenclatura

| Elemento | Padrão | Exemplo |
|---|---|---|
| Variáveis e funções (TS) | camelCase | `valorIndividual`, `calcularPrevia()` |
| Componentes React | PascalCase | `CardCarona.tsx` |
| Tipos e interfaces | PascalCase (sem prefixo `I`) | `Carona`, `ReservaCriada` |
| Constantes globais | UPPER_SNAKE_CASE | `MINUTOS_EXPIRACAO_RESERVA` |
| Enums (valores) | UPPER_SNAKE_CASE | `ABERTA`, `PENDENTE` |
| Arquivos TS | kebab-case | `reserva.service.ts`, `erros.ts` |
| Edge Functions | pasta kebab-case, verbo + objeto | `supabase/functions/reservar-vaga/index.ts` |
| Tabelas e colunas | snake_case singular (igual ao DER) | `carona.vagas_disponiveis` |
| Funções SQL (RPC) | snake_case, verbo no infinitivo | `reservar_vaga`, `buscar_caronas` |
| Parâmetros de função SQL | prefixo `p_` | `p_id_carona` |
| Políticas RLS | frase em português entre aspas | `"motorista gerencia os próprios veículos"` |
| Migrations | `supabase migration new` + descrição snake_case | `20260925120000_reserva_pagamento.sql` |
| Booleanos | prefixo `is/tem/pode` ou adjetivo claro | `somente_mulheres`, `lida` |

**Idioma:** domínio em português (`carona`, `rateio`, `motorista`); termos técnicos consagrados em inglês (`hook`, `trigger`, `policy`, `service`). Não misturar na mesma palavra (`getCaronas` → `listarCaronas`).

## 2. Formatação

- **App:** Prettier (2 espaços, aspas simples, ponto e vírgula, `printWidth: 100`, `trailingComma: all`) e ESLint (`@typescript-eslint/recommended`, `no-explicit-any`, `no-console`).
- **Edge Functions:** `deno fmt` e `deno lint`, configurados em `supabase/functions/deno.json` com as mesmas regras (`indentWidth: 2`, `singleQuote: true`, `semiColons: true`, `lineWidth: 100`).
- **SQL:** palavras-chave em minúsculas, 2 espaços, uma cláusula por linha; nomes sempre qualificados com o schema (`public.carona`).
- **TypeScript:** `strict: true`. Nada de `any`; use `unknown` + narrowing.
- Imports ordenados: bibliotecas externas → módulos internos → relativos. Nas Edge Functions, dependências com especificador explícito (`npm:zod@3`, `jsr:@supabase/supabase-js@2`).
- Rodar lint e format (app e Edge Functions) antes de cada commit.

## 3. Boas práticas

- Funções pequenas, com uma responsabilidade. Mais de ~40 linhas é sinal para quebrar (vale para `plpgsql` também).
- `async/await` sempre.
- **Privilégios (migration `privilegios_padrao`):** tabelas, sequences e funções novas criadas pelas migrations nascem **sem** privilégio para `anon`/`authenticated` (e funções sem `EXECUTE` para `PUBLIC`). Toda tabela recebe `grant` explícito só das operações/colunas que o app usa, e **toda função nova recebe `GRANT EXECUTE` explícito só para quem precisa** (`authenticated`, `service_role` ou `supabase_auth_admin`). Mesmo assim, escreva o `revoke ... from public, anon, authenticated` na migration: deixa a intenção visível no PR.
- **Erros em funções SQL:** `raise exception '<CODIGO>' using errcode = 'PT4xx', hint = '<mensagem para o usuário>'` (ver `docs/API.md`).
- **Erros em Edge Functions:** lançar `AppError(status, code, message, details?)` de `_shared/erros.ts`. Todo handler é envolvido por `comTratamentoDeErros` (`_shared/resposta.ts`), que responde o preflight de CORS e converte o erro em `{ error: { code, message, details } }`; erro que não é `AppError` vira 500 `ERRO_INTERNO` com mensagem genérica (detalhe só no log).
- **No app:** chamadas ao Supabase só em `mobile/src/services/`, que convertem qualquer erro em `AppError`. Telas não usam o cliente Supabase direto.
- Validação de entrada com **Zod** nas Edge Functions (`validarCorpo(req, schema)` de `_shared/validacao.ts`, que responde 400 `PAYLOAD_INVALIDO` com `details.campos`); funções SQL validam os próprios parâmetros; o banco garante formatos com `CHECK`.
- Regra que precisa de transação vai para **uma** função SQL — não encadear várias chamadas do app/Edge Function esperando atomicidade.
- Dinheiro em **centavos (inteiro)** no TypeScript; `numeric(10,2)` no banco. Nunca `number` com casas decimais para cálculo.
- Datas em UTC no banco; conversão para `America/Sao_Paulo` só na exibição.
- Sem números mágicos: valores de regra ficam em constantes ou em PARAMETRO_CUSTO.
- Comentário explica o **porquê**: `-- teto evita caracterizar transporte remunerado (ADR-007)`.

## 4. Estrutura de pastas

Organização **por funcionalidade** (módulo). Ver `AGENTS.md` → Estrutura de pastas.

```
supabase/
├── migrations/
│   ├── 20260925120000_init.sql                  # tabelas base + RLS
│   └── 20261001120000_reserva_pagamento.sql     # tabelas + RLS + funções do módulo
├── functions/
│   ├── _shared/            # erros.ts, resposta.ts, cors.ts, validacao.ts (+ testes)
│   └── reservar-vaga/
│       ├── index.ts
│       └── index.test.ts   # deno test
└── tests/
    └── reservas.test.sql   # pgTAP: RLS e reservar_vaga
```

No app: telas em `mobile/app/` (Expo Router), componentes reutilizáveis em `mobile/src/components/`, chamadas ao Supabase só em `mobile/src/services/`, tipos gerados em `mobile/src/types/database.ts`.

## 5. Git

### Branches

| Branch | Uso |
|---|---|
| `main` | Código estável, sempre funcional. Deploy automático no Supabase (GitHub Actions: `supabase db push` + `supabase functions deploy`). |
| `develop` | Integração das features. Base para novas branches. |
| `feature/T<ID>-<resumo>` | Uma por tarefa do TASKS.md. Ex.: `feature/T09-validacao-dominio` |
| `fix/<resumo>` | Correção de bug encontrado depois do merge |

Fluxo: `develop` → `feature/...` → PR para `develop` → ao fim da sprint, PR `develop` → `main`.

### Commits (Conventional Commits)

Formato: `tipo(escopo): descrição no imperativo, em minúsculas, sem ponto final`

| Tipo | Quando |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Documentação |
| `refactor` | Mudança de código sem mudar comportamento |
| `test` | Testes |
| `style` | Formatação (sem mudança de lógica) |
| `chore` | Configuração, dependências, build |

Escopos: `auth`, `usuarios`, `veiculos`, `caronas`, `reservas`, `pagamentos`, `notificacoes`, `avaliacoes`, `db`, `mobile`, `infra`.

Exemplos:
```
feat(auth): valida domínio institucional no cadastro
fix(reservas): impede reserva dupla na mesma carona
test(reservas): cobre concorrência na última vaga
docs(db): atualiza dicionário com expo_push_token
chore(infra): configura deploy do supabase via github actions
```

### Pull Requests

- Título = commit principal; corpo com o modelo abaixo.
- Pelo menos **1 aprovação** de outro membro antes do merge — inclusive quando o código foi gerado com IA.
- PR com migration: revisor confere RLS e `grant`/`revoke` das tabelas e funções (nada nasce acessível ao app sem `grant` explícito).
- Merge por **squash**; apagar a branch depois.

```markdown
## Tarefa
T09 — Validação de domínio no cadastro

## O que foi feito
- ...

## Como testar
1. ...

## Checklist
- [ ] Critério de aceite da tarefa cumprido
- [ ] `supabase db reset` sem erro e testes passando (`supabase test db`, `deno test`)
- [ ] RLS habilitada e testada nas tabelas novas
- [ ] Lint sem erros
- [ ] Tipos regenerados (`supabase gen types`), se o schema mudou
- [ ] Docs atualizadas (DATABASE/API/SPEC, se aplicável)
- [ ] TASKS.md e MEMORY.md atualizados
- [ ] Código gerado por IA foi lido e entendido por quem abriu o PR
```

## 6. Testes

- **Banco (funções SQL e RLS):** pgTAP em `supabase/tests/`, executado com `supabase test db`. Testes de RLS simulam usuários com `set local role authenticated` + `request.jwt.claims`.
- **Edge Functions:** `deno test` (arquivo `*.test.ts` ao lado da função), com Mercado Pago/Directions/Expo simulados.
- **App:** testes de componentes e serviços em `mobile/tests/`.
- Toda função SQL e Edge Function nova tem pelo menos 1 teste; toda política RLS nova tem teste de acesso negado.
- Regras críticas com testes obrigatórios: validação de domínio, rateio, teto de preço, concorrência na reserva (duas conexões disputando a última vaga), idempotência do webhook, isolamento por RLS.
