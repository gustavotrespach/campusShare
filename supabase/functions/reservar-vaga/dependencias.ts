// Liga o handler aos serviços reais: Supabase (Auth + RPC com service_role) e Mercado Pago.
// Separado do handler para os testes trocarem só o fetch.
import { chamarRpc, type ConfigSupabase, usuarioDoToken } from '../_shared/supabase-rest.ts';

import type { Dependencias, Log, ReservaCriada } from './handler.ts';
import { type ConfigMercadoPago, criarCobrancaPix } from './mercado-pago.ts';

type Registro = Record<string, unknown>;

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null;
}

// reservar_vaga devolve uma tabela de uma linha; valores em reais (numeric) viram centavos aqui
function lerReserva(resultado: unknown): ReservaCriada {
  const linha: unknown = Array.isArray(resultado) ? resultado[0] : null;
  if (
    !ehRegistro(linha) || typeof linha.id_reserva !== 'string' ||
    typeof linha.id_pagamento !== 'string' || typeof linha.valor_individual !== 'number'
  ) {
    throw new Error('reservar_vaga devolveu um formato inesperado');
  }
  return {
    idReserva: linha.id_reserva,
    idPagamento: linha.id_pagamento,
    valorCentavos: Math.round(linha.valor_individual * 100),
  };
}

// Só ids, status e motivos curtos no log: nunca token, corpo do Mercado Pago ou dados pessoais
export const logPadrao: Log = (evento, dados) => {
  console.log(JSON.stringify({ funcao: 'reservar-vaga', evento, ...dados }));
};

export function criarDependencias(config: {
  supabase: ConfigSupabase;
  mercadoPago: ConfigMercadoPago;
  log?: Log;
  origensCors?: string[];
}): Dependencias {
  return {
    cobrancaDisponivel: config.mercadoPago.accessToken.length > 0,
    usuarioDoToken: (token) => usuarioDoToken(config.supabase, token),
    reservarVaga: async (idCarona, idPassageiro) =>
      lerReserva(
        await chamarRpc(config.supabase, 'reservar_vaga', {
          p_id_carona: idCarona,
          p_id_passageiro: idPassageiro,
        }),
      ),
    criarCobrancaPix: (pedido) => criarCobrancaPix(config.mercadoPago, pedido),
    registrarCobranca: async (idPagamento, idOrder) => {
      await chamarRpc(config.supabase, 'registrar_cobranca', {
        p_id_pagamento: idPagamento,
        p_id_externo: idOrder,
      });
    },
    desfazerReserva: async (idReserva) =>
      (await chamarRpc(config.supabase, 'desfazer_reserva_sem_cobranca', {
        p_id_reserva: idReserva,
      })) === true,
    log: config.log ?? logPadrao,
    origensCors: config.origensCors,
  };
}
