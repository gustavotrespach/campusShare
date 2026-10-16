# CONTEXT.md — Negócio e domínio

## O problema

Alunos da ULBRA Campus Torres vêm de cidades e bairros da região e dependem de carro próprio, transporte público limitado ou caronas combinadas em grupos de mensagem. Nos grupos, não há garantia de que a pessoa é mesmo aluna, e o acerto de valores gera constrangimento ("quanto eu te devo?", "depois eu te passo").

## A proposta de valor

1. **Confiança:** só entra quem confirma um e-mail institucional.
2. **Sem constrangimento financeiro:** o sistema calcula o rateio e o pagamento acontece dentro do app.
3. **Preço justo:** o valor é baseado no custo real de combustível, com teto — é divisão de despesas, não um serviço de transporte.

## Modelo de negócio

- Receita: **taxa percentual** sobre cada carona paga (`taxa_plataforma`), conforme o Lean Canvas da AP1.
- O restante (`valor_repassado`) vai para o motorista.
- Custo de infraestrutura zero no MVP (free tiers).
- Expansão futura: outras instituições (basta cadastrar em INSTITUICAO).

## Personas

**Motorista — "Lucas", 22 anos, Engenharia**
Vem de carro de Arroio do Sal todos os dias, com 3 lugares sobrando. Quer dividir o combustível sem ter que cobrar colega por mensagem.

**Passageira — "Mariana", 19 anos, ADS**
Mora em Torres, longe do campus, e não tem carro. Prefere viajar com outras mulheres e quer saber quem é o motorista antes de entrar no carro.

**Aluno nos dois papéis — "Pedro", 24 anos, Administração**
Às vezes vai de carro, às vezes de carona, dependendo do dia. Não quer contas separadas.

## Glossário

| Termo | Significado |
|---|---|
| Carona | Viagem publicada por um motorista, com origem, destino, horário e vagas |
| Motorista | Usuário que publica a carona com um de seus veículos |
| Passageiro | Usuário que reserva vaga em carona de outro |
| Reserva | Vínculo entre passageiro e carona; ocupa uma vaga |
| Rateio | Divisão do custo da viagem entre os ocupantes |
| Custo estimado | Custo de combustível calculado pelo sistema; é o teto do preço |
| Custo total | Valor que o motorista define para a viagem (≤ custo estimado) |
| Valor individual | Parte do custo que cabe a cada passageiro |
| Taxa da plataforma | Percentual retido pelo CampusShare em cada pagamento |
| Valor repassado | O que o motorista recebe após a taxa |
| Tolerância | Minutos que o motorista espera após o horário de partida |
| Somente mulheres | Carona restrita a passageiras |
| Domínio institucional | Parte do e-mail após o `@` que identifica a instituição (`rede.ulbra.br`) |
| PARAMETRO_CUSTO | Tabela com preço do litro e percentual da taxa, mantida pela equipe |

## Linha do tempo acadêmica

| Aula | Entrega |
|---|---|
| 7 | AP1 — apresentação (problema, Lean Canvas, protótipo, backlog) |
| 8 | Arquitetura e modelagem |
| 9 | Padrões, Git e IA (SDD) |
| 10–11 | Sprints de desenvolvimento |
| 12 | AP2 — demo do MVP (22/10/2026) |
