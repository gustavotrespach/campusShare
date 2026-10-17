#!/usr/bin/env bash
# T21 — Concorrência na última vaga (RN17, caso de borda do SPEC.md): duas reservas simultâneas de
# passageiros diferentes na última vaga; só uma passa e a outra recebe CARONA_LOTADA.
#
# O pgTAP roda numa única transação e não prova concorrência, por isso este script abre duas
# sessões psql de verdade no container do banco local:
#   A) reserva a última vaga e segura a transação (pg_sleep) com a carona travada (FOR UPDATE);
#   B) começa só quando A já está segurando o lock, espera e, quando A confirma, recebe CARONA_LOTADA.
# Prepara e limpa os próprios dados. Sai com código ≠ 0 se a regra falhar.
#
# Uso: supabase start (ou db reset) e depois `bash supabase/tests/concorrencia/ultima_vaga.sh`.
# Roda também no job `banco` do CI.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
# O container do banco local se chama supabase_db_<project_id> (primeira linha do config.toml)
project_id="$(sed -n 's/^project_id = "\(.*\)"$/\1/p' "$raiz/supabase/config.toml" | head -n 1)"
container="supabase_db_${project_id}"

CARONA='cc000000-0000-0000-0000-000000000001'
MOTORISTA='cc000000-0000-0000-0000-00000000000a'
PASSAGEIRO_A='cc000000-0000-0000-0000-00000000000b'
PASSAGEIRO_B='cc000000-0000-0000-0000-00000000000c'
ESPERA_A=3

sql() {
  docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -qAt "$@"
}

limpar() {
  # A exclusão das contas leva veículo, carona, reservas e pagamentos em cascata
  sql -c "delete from auth.users where id in ('$MOTORISTA', '$PASSAGEIRO_A', '$PASSAGEIRO_B');" \
    > /dev/null
}

falhar() {
  echo "FALHOU: $1" >&2
  exit 1
}

saida_a="$(mktemp)"
saida_b="$(mktemp)"
trap 'limpar; rm -f "$saida_a" "$saida_b"' EXIT

echo "Banco: container $container"
limpar

# Carona de 2 vagas com 1 já ocupada: sobra exatamente a última vaga.
# O domínio rede.ulbra.br vem da migration dados_iniciais; o perfil nasce pelo trigger.
sql > /dev/null <<SQL
insert into auth.users (id, email, raw_user_meta_data) values
  ('$MOTORISTA', 'concorrencia.motorista@rede.ulbra.br', '{"nome_completo": "Motorista Concorrência"}'),
  ('$PASSAGEIRO_A', 'concorrencia.a@rede.ulbra.br', '{"nome_completo": "Passageiro A"}'),
  ('$PASSAGEIRO_B', 'concorrencia.b@rede.ulbra.br', '{"nome_completo": "Passageiro B"}');
insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values ('cc100000-0000-0000-0000-000000000001', '$MOTORISTA', 'Gol', 'CCC9C99', 'Azul', 5);
insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min
) values (
  '$CARONA', '$MOTORISTA', 'cc100000-0000-0000-0000-000000000001', 'Centro, Torres', -29.3353,
  -49.7268, 'ULBRA Torres', -29.329, -49.7365, now() + interval '1 day', 2, 1, 24, 10
);
SQL
echo "Carona de teste criada com 1 vaga disponível."

# Sessão A: reserva e segura a transação aberta com a carona travada
sql > "$saida_a" 2>&1 <<SQL &
begin;
select 'A reservou ' || status from public.reservar_vaga('$CARONA', '$PASSAGEIRO_A');
select pg_sleep($ESPERA_A);
commit;
SQL
pid_a=$!

# Só dispara B quando A já está dentro do pg_sleep, ou seja, com o lock da carona
for _ in $(seq 1 50); do
  ativa="$(sql -c "select count(*) from pg_stat_activity
    where state = 'active' and query like 'select pg_sleep($ESPERA_A)%';")"
  [ "$ativa" = "1" ] && break
  sleep 0.1
done
[ "$ativa" = "1" ] || falhar "a sessão A não chegou a segurar o lock"
echo "Sessão A segura a carona; disparando a sessão B."

# Sessão B: tenta a mesma vaga; precisa esperar A e então ver a carona LOTADA
inicio_b=$SECONDS
set +e
sql > "$saida_b" 2>&1 <<SQL
select 'B reservou ' || status from public.reservar_vaga('$CARONA', '$PASSAGEIRO_B');
SQL
codigo_b=$?
set -e
espera_b=$((SECONDS - inicio_b))

wait "$pid_a" || falhar "a sessão A falhou: $(cat "$saida_a")"

echo "--- Sessão A"
cat "$saida_a"
echo "--- Sessão B (esperou ~${espera_b}s pelo lock; código $codigo_b)"
cat "$saida_b"

[ "$codigo_b" -ne 0 ] || falhar "a sessão B também reservou"
grep -q 'CARONA_LOTADA' "$saida_b" || falhar "a sessão B não recebeu CARONA_LOTADA"
[ "$espera_b" -ge 1 ] || falhar "a sessão B não esperou o lock da sessão A"

estado="$(sql -c "select c.vagas_disponiveis || ' ' || c.status || ' ' ||
    (select count(*) from public.reserva r where r.id_carona = c.id_carona) || ' ' ||
    (select count(*) from public.reserva r
     where r.id_carona = c.id_carona and r.id_passageiro = '$PASSAGEIRO_A')
  from public.carona c where c.id_carona = '$CARONA';")"
echo "--- Estado final: vagas_disponiveis status reservas reservas_de_A = $estado"
[ "$estado" = "0 LOTADA 1 1" ] || falhar "estado final inesperado: $estado"

echo "OK: só uma reserva na última vaga; a outra recebeu CARONA_LOTADA."
