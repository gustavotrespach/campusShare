// POST /functions/v1/reservar-vaga — único caminho do app para reservar (US04, T22).
// 1) reservar_vaga (T21): reserva e pagamento PENDENTE numa transação, com o passageiro do JWT;
// 2) cobrança Pix na API de Orders do Mercado Pago;
// 3) registrar_cobranca: liga a order ao pagamento.
// Se 2 ou 3 falham, desfazer_reserva_sem_cobranca devolve a vaga e o app recebe 502.
import { AppError } from '../_shared/erros.ts';
import { comTratamentoDeErros } from '../_shared/resposta.ts';
import { validarCorpo, z } from '../_shared/validacao.ts';
import type { UsuarioAutenticado } from '../_shared/supabase-rest.ts';

import type { CobrancaPix, PedidoPix } from './mercado-pago.ts';

export interface ReservaCriada {
  idReserva: string;
  idPagamento: string;
  valorCentavos: number;
}

export type Log = (evento: string, dados: Record<string, string | number | boolean>) => void;

export interface Dependencias {
  cobrancaDisponivel: boolean;
  usuarioDoToken: (token: string) => Promise<UsuarioAutenticado>;
  reservarVaga: (idCarona: string, idPassageiro: string) => Promise<ReservaCriada>;
  criarCobrancaPix: (pedido: PedidoPix) => Promise<CobrancaPix>;
  registrarCobranca: (idPagamento: string, idOrder: string) => Promise<void>;
  desfazerReserva: (idReserva: string) => Promise<boolean>;
  log: Log;
  origensCors?: string[];
}

// Só o id da carona: o passageiro vem do JWT validado, nunca do corpo (AGENTS.md).
// z.guid() (formato 8-4-4-4-12) em vez de z.uuid(): o Postgres aceita qualquer uuid nesse formato,
// inclusive os ids fixos do seed.sql, que não têm os bits de versão da RFC 9562.
const esquemaCorpo = z.strictObject({ id_carona: z.guid() });

const MENSAGEM_PAGAMENTO_INDISPONIVEL =
  'Não foi possível gerar o Pix agora. Tente de novo em instantes.';

function tokenDaRequisicao(req: Request): string {
  const autorizacao = req.headers.get('authorization') ?? '';
  const [esquema, token] = autorizacao.split(' ');
  if (esquema?.toLowerCase() !== 'bearer' || !token) {
    throw new AppError(401, 'NAO_AUTENTICADO', 'Entre na sua conta para reservar.');
  }
  return token;
}

function primeiroNome(nomeCompleto: string | null): string | null {
  return nomeCompleto?.trim().split(/\s+/)[0] || null;
}

export function criarHandler(deps: Dependencias): (req: Request) => Promise<Response> {
  return comTratamentoDeErros(async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') {
      throw new AppError(405, 'METODO_NAO_PERMITIDO', 'Use POST para reservar.');
    }
    const usuario = await deps.usuarioDoToken(tokenDaRequisicao(req));
    const { id_carona: idCarona } = await validarCorpo(req, esquemaCorpo);

    // Sem credencial do Mercado Pago a reserva nem começa (não prende vaga à toa)
    if (!deps.cobrancaDisponivel) {
      deps.log('cobranca_nao_configurada', { id_carona: idCarona });
      throw new AppError(503, 'PAGAMENTO_INDISPONIVEL', MENSAGEM_PAGAMENTO_INDISPONIVEL);
    }

    // Erros do domínio (CARONA_LOTADA, RESERVA_DUPLICADA...) seguem para o app como estão
    const reserva = await deps.reservarVaga(idCarona, usuario.id);

    let cobranca: CobrancaPix;
    try {
      cobranca = await deps.criarCobrancaPix({
        idPagamento: reserva.idPagamento,
        valorCentavos: reserva.valorCentavos,
        email: usuario.email,
        primeiroNome: primeiroNome(usuario.nomeCompleto),
      });
      await deps.registrarCobranca(reserva.idPagamento, cobranca.idOrder);
    } catch (erro) {
      deps.log('cobranca_falhou', {
        id_reserva: reserva.idReserva,
        id_pagamento: reserva.idPagamento,
        motivo: erro instanceof Error ? erro.message : 'desconhecido',
      });
      try {
        const desfeita = await deps.desfazerReserva(reserva.idReserva);
        deps.log('reserva_desfeita', { id_reserva: reserva.idReserva, desfeita });
      } catch (erroAoDesfazer) {
        // A vaga fica presa até a expiração (T24); o log permite liberar à mão
        deps.log('falha_ao_desfazer_reserva', {
          id_reserva: reserva.idReserva,
          motivo: erroAoDesfazer instanceof Error ? erroAoDesfazer.message : 'desconhecido',
        });
      }
      throw new AppError(502, 'PAGAMENTO_INDISPONIVEL', MENSAGEM_PAGAMENTO_INDISPONIVEL);
    }

    deps.log('cobranca_criada', {
      id_reserva: reserva.idReserva,
      id_pagamento: reserva.idPagamento,
      id_order: cobranca.idOrder,
      status_order: cobranca.status,
    });

    // Dinheiro em centavos (AGENTS.md); taxa, repasse e id da order ficam no backend
    return Response.json(
      {
        data: {
          id_reserva: reserva.idReserva,
          id_pagamento: reserva.idPagamento,
          valor_centavos: reserva.valorCentavos,
          status: 'PENDENTE',
          pix: {
            qr_code: cobranca.qrCode,
            qr_code_base64: cobranca.qrCodeBase64,
            ticket_url: cobranca.ticketUrl,
          },
        },
      },
      { status: 201 },
    );
  }, deps.origensCors);
}
