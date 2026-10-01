# ADR-005: Regras de negócio só no servidor

## Status
Aceito

> Nota (2026-09-24): com a ADR-009, "API" neste documento passa a significar o backend Supabase — funções SQL, políticas RLS, constraints e Edge Functions. A decisão continua valendo.

## Data
2026-09-17

## Contexto
O rateio e a validação do domínio `@ulbra.br` sustentam a proposta de valor (confiança e preço justo). Um app modificado pode enviar qualquer valor à API.

## Decisão
Validação de domínio, rateio, teto de preço, taxa, controle de vagas e filtro "somente mulheres" são executados **exclusivamente na API**. O app pode exibir prévias, mas a API sempre recalcula e ignora valores calculados vindos do cliente.

## Alternativas consideradas
- **Calcular no app e confiar no valor** — burlável com um app modificado.
- **Duplicar a regra no app e na API** — risco de divergência; aceitável apenas como prévia visual.

## Consequências
- Positivo: um único ponto de verdade; regras testáveis em um lugar.
- Positivo: mudar parâmetros (preço do litro, taxa) não exige nova versão do app.
- Negativo: toda prévia de valor precisa de uma chamada à API.
