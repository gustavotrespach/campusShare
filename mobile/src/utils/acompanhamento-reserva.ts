// Polling da tela de pagamento (T25): consulta o status a cada 5 s enquanto a reserva estiver
// PENDENTE, por no máximo 15 min. Decisão do squad: polling em vez de Realtime até a AP2 (não muda o
// banco e funciona no Expo Go). A confirmação em si vem só do webhook (ADR-008): aqui só se lê.
import { reservaEmAberto, type StatusReserva } from './reserva';

export const INTERVALO_ACOMPANHAMENTO_MS = 5_000;
export const LIMITE_ACOMPANHAMENTO_MS = 15 * 60 * 1000;

export interface OpcoesAcompanhamento<Situacao extends { statusReserva: StatusReserva }> {
  consultar: () => Promise<Situacao>;
  aoAtualizar: (situacao: Situacao) => void;
  // Falha de uma consulta (rede, sessão) não para o polling: a próxima tenta de novo
  aoFalhar?: (erro: unknown) => void;
  // Passaram os 15 min com a reserva ainda PENDENTE
  aoEsgotar?: () => void;
  intervaloMs?: number;
  limiteMs?: number;
  agora?: () => number;
}

// Começa com uma consulta imediata e devolve a função que para. setTimeout encadeado, e não
// setInterval: uma consulta lenta nunca se sobrepõe à seguinte.
export function acompanharReserva<Situacao extends { statusReserva: StatusReserva }>(
  opcoes: OpcoesAcompanhamento<Situacao>,
): () => void {
  const intervaloMs = opcoes.intervaloMs ?? INTERVALO_ACOMPANHAMENTO_MS;
  const limiteMs = opcoes.limiteMs ?? LIMITE_ACOMPANHAMENTO_MS;
  const agora = opcoes.agora ?? Date.now;
  const inicio = agora();
  let parado = false;
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  const parar = () => {
    parado = true;
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  };

  const agendar = () => {
    if (parado) {
      return;
    }
    if (agora() - inicio >= limiteMs) {
      parar();
      opcoes.aoEsgotar?.();
      return;
    }
    temporizador = setTimeout(() => {
      temporizador = null;
      void rodada();
    }, intervaloMs);
  };

  const rodada = async () => {
    try {
      const situacao = await opcoes.consultar();
      // Saiu da tela enquanto a consulta estava no ar: não atualiza nada
      if (parado) {
        return;
      }
      opcoes.aoAtualizar(situacao);
      if (!reservaEmAberto(situacao.statusReserva)) {
        parar();
        return;
      }
    } catch (erro) {
      if (parado) {
        return;
      }
      opcoes.aoFalhar?.(erro);
    }
    agendar();
  };

  void rodada();
  return parar;
}
