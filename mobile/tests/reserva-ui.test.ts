// Regras de interface da T25: botão Reservar, rótulos de status, mensagens de erro e o store do
// Pix em memória.
import type { ReservaCriada } from '@/services/reservas';
import { descartarPix, guardarPix, limparPix, obterPix } from '@/store/pix';
import {
  atalhoDoErroDeReserva,
  mensagemDoErroDeReserva,
  podeReservar,
  reservaEmAberto,
  rotuloStatusReserva,
} from '@/utils/reserva';

describe('podeReservar', () => {
  const aberta = { sou_motorista: false, status: 'ABERTA' as const, vagas_disponiveis: 2 };

  it('passageiro em carona aberta com vaga vê o botão', () => {
    expect(podeReservar(aberta)).toBe(true);
  });

  it('o motorista não vê o botão na própria carona', () => {
    expect(podeReservar({ ...aberta, sou_motorista: true })).toBe(false);
  });

  it.each(['LOTADA', 'CANCELADA', 'CONCLUIDA'] as const)(
    'carona %s não mostra o botão',
    (status) => {
      expect(podeReservar({ ...aberta, status })).toBe(false);
    },
  );

  it('sem vaga disponível não mostra o botão', () => {
    expect(podeReservar({ ...aberta, vagas_disponiveis: 0 })).toBe(false);
  });
});

describe('status da reserva', () => {
  it('rótulos legíveis', () => {
    expect(rotuloStatusReserva('PENDENTE')).toBe('Aguardando pagamento');
    expect(rotuloStatusReserva('CONFIRMADA')).toBe('Confirmada');
    expect(rotuloStatusReserva('CANCELADA')).toBe('Cancelada');
    expect(rotuloStatusReserva('EXPIRADA')).toBe('Expirada');
  });

  it('só PENDENTE segue em aberto', () => {
    expect(reservaEmAberto('PENDENTE')).toBe(true);
    expect(reservaEmAberto('CONFIRMADA')).toBe(false);
    expect(reservaEmAberto('CANCELADA')).toBe(false);
    expect(reservaEmAberto('EXPIRADA')).toBe(false);
  });
});

describe('erros da reserva', () => {
  it('RESERVA_DUPLICADA leva a Minhas reservas; os outros não têm atalho', () => {
    expect(mensagemDoErroDeReserva('RESERVA_DUPLICADA')).toBe(
      'Você já tem uma reserva nesta carona.',
    );
    expect(atalhoDoErroDeReserva('RESERVA_DUPLICADA')).toBe('minhas_reservas');
    expect(atalhoDoErroDeReserva('CARONA_LOTADA')).toBeNull();
  });

  it('código desconhecido não tem mensagem própria', () => {
    expect(mensagemDoErroDeReserva('QUALQUER_OUTRO')).toBeNull();
  });
});

describe('store do Pix', () => {
  function reserva(idReserva: string): ReservaCriada {
    return {
      idReserva,
      idPagamento: `pag-${idReserva}`,
      valorCentavos: 500,
      status: 'PENDENTE',
      pix: { qrCode: `codigo-${idReserva}`, qrCodeBase64: 'iVBOR', ticketUrl: null },
    };
  }

  beforeEach(() => {
    limparPix();
  });

  it('guarda e devolve pelo id_reserva', () => {
    guardarPix(reserva('r1'));
    guardarPix(reserva('r2'));
    expect(obterPix('r1')?.pix.qrCode).toBe('codigo-r1');
    expect(obterPix('r2')?.pix.qrCode).toBe('codigo-r2');
  });

  it('sem Pix em memória (ex.: app reaberto) devolve null', () => {
    expect(obterPix('desconhecida')).toBeNull();
  });

  it('descartar remove só aquela reserva; limpar remove todas', () => {
    guardarPix(reserva('r1'));
    guardarPix(reserva('r2'));
    descartarPix('r1');
    expect(obterPix('r1')).toBeNull();
    expect(obterPix('r2')).not.toBeNull();
    limparPix();
    expect(obterPix('r2')).toBeNull();
  });
});
