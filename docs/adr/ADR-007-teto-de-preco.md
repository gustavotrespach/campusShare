# ADR-007: Teto de preço pelo custo de combustível

## Status
Aceito

## Data
2026-09-17

## Contexto
Se o motorista puder cobrar qualquer valor, a carona passa a ser transporte remunerado, sujeito a exigências regulatórias mais rígidas. Além disso, o preço justo faz parte da proposta de valor.

## Decisão
O sistema calcula `custo_estimado = (distancia_km ÷ consumo_kml) × preco_litro` e o apresenta como sugestão. O motorista pode **reduzir**, mas **não ultrapassar** esse valor. A distância vem da Directions API; o consumo, do cadastro do veículo (a motorização só sugere o valor inicial, pois isolada é imprecisa); o preço do litro, de PARAMETRO_CUSTO.

Implantação por etapas: Sprint 2 com valor digitado (sem teto); Sprint 3 com sugestão e teto.

## Alternativas consideradas
- **Preço livre** — risco regulatório e de abuso.
- **Preço fixo por km** — ignora o consumo real de cada veículo.

## Consequências
- Positivo: mantém o produto como divisão de despesas.
- Positivo: preço do litro ajustável sem mudar código.
- Negativo: depende da Directions API (custo e cota); é preciso fallback se ela falhar.
