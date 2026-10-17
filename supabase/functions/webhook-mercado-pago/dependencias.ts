// Liga o handler aos serviços reais: API de Orders do Mercado Pago e confirmar_pagamento (service_role).
import { chamarRpc, type ConfigSupabase } from '../_shared/supabase-rest.ts';

import type { Dependencias, Log } from './handler.ts';
import { type ConfigOrders, consultarOrder } from './orders.ts';

// Só ids, status e códigos no log: nunca token, segredo, corpo da notificação ou dados pessoais
export const logPadrao: Log = (evento, dados) => {
  console.log(JSON.stringify({ funcao: 'webhook-mercado-pago', evento, ...dados }));
};

export function criarDependencias(config: {
  supabase: ConfigSupabase;
  orders: ConfigOrders;
  segredo: string;
  agoraMs?: () => number;
  log?: Log;
  origensCors?: string[];
}): Dependencias {
  return {
    segredo: config.segredo,
    agoraMs: config.agoraMs ?? (() => Date.now()),
    consultarOrder: (idOrder) => consultarOrder(config.orders, idOrder),
    confirmarPagamento: async (idOrder, idPagamento, valor) => {
      const resultado = await chamarRpc(config.supabase, 'confirmar_pagamento', {
        p_id_externo: idOrder,
        p_id_pagamento: idPagamento,
        p_valor: valor,
      });
      if (typeof resultado !== 'string') {
        throw new Error('confirmar_pagamento devolveu um formato inesperado');
      }
      return resultado;
    },
    log: config.log ?? logPadrao,
    origensCors: config.origensCors,
  };
}
