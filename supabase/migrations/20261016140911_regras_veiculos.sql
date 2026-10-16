-- T15 — Regras de veículos: veículo usado em carona não pode ser excluído.
-- A FK carona → veiculo (NO ACTION) já recusa a exclusão com o erro técnico 23503; o trigger
-- antecipa a recusa com um código do domínio que o app traduz (docs/API.md → "veiculos").

-- ============================================================
-- Trigger: impedir_exclusao_veiculo_em_uso
-- ============================================================

-- SECURITY DEFINER: a regra precisa enxergar todas as caronas do veículo, independente da RLS
-- de quem exclui (hoje o motorista vê as próprias, mas a regra não deve depender disso).
create function public.impedir_exclusao_veiculo_em_uso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Exclusão da conta: auth.users → usuario → veiculo e carona em cascata, na mesma transação.
  -- O perfil já foi removido quando a cascata chega aqui; recusar impediria excluir a conta.
  if not exists (select 1 from public.usuario u where u.id_usuario = old.id_motorista) then
    return old;
  end if;

  if exists (
    select 1
    from public.carona c
    where c.id_veiculo = old.id_veiculo
      and c.status in ('ABERTA', 'LOTADA')
  ) then
    raise exception 'VEICULO_EM_USO'
      using errcode = 'PT409',
        hint = 'Este veículo está em uma carona ativa. Cancele ou conclua a carona antes de excluí-lo.';
  end if;

  -- Caronas concluídas ou canceladas são histórico (reservas, pagamentos e avaliações vão apontar
  -- para elas); a exclusão lógica do veículo fica para depois da AP2 (MEMORY.md).
  if exists (select 1 from public.carona c where c.id_veiculo = old.id_veiculo) then
    raise exception 'VEICULO_COM_HISTORICO'
      using errcode = 'PT409',
        hint = 'Este veículo tem caronas registradas no histórico e não pode ser excluído.';
  end if;

  return old;
end;
$$;

-- Função de trigger: ninguém a chama diretamente (o trigger não exige EXECUTE em tempo de execução)
revoke execute on function public.impedir_exclusao_veiculo_em_uso()
  from public, anon, authenticated, service_role;

create trigger impedir_exclusao_veiculo_em_uso
  before delete on public.veiculo
  for each row
  execute function public.impedir_exclusao_veiculo_em_uso();
