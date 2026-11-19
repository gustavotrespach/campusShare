// Meus veículos, Novo veículo e Editar veículo com a identidade visual (T39). Os services são
// falsos: o teste confere que a lista, os campos, os botões e as mensagens continuam na tela.
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import TelaEditarVeiculo from '../app/(autenticado)/veiculos/[id]';
import TelaVeiculos from '../app/(autenticado)/veiculos/index';
import TelaNovoVeiculo from '../app/(autenticado)/veiculos/novo';
import { AppError } from '@/services/erros';
import {
  cadastrarVeiculo,
  listarMeusVeiculos,
  obterVeiculo,
  type Veiculo,
} from '@/services/veiculos';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));

jest.mock('@/services/veiculos', () => ({
  CODIGO_PLACA_DUPLICADA: 'PLACA_DUPLICADA',
  listarMeusVeiculos: jest.fn(),
  obterVeiculo: jest.fn(),
  cadastrarVeiculo: jest.fn(),
  atualizarVeiculo: jest.fn(),
  excluirVeiculo: jest.fn(),
}));

const ONIX: Veiculo = {
  id_veiculo: 'v1',
  modelo: 'Chevrolet Onix',
  placa: 'IYK4B21',
  cor: 'Prata',
  qtd_lugares: 5,
  motorizacao: '1.0',
  consumo_kml: 12.5,
} as Veiculo;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Meus veículos (tela 11)', () => {
  it('lista o veículo com modelo, cor, lugares e placa, e o botão de cadastrar', async () => {
    jest.mocked(listarMeusVeiculos).mockResolvedValue([ONIX]);
    await render(<TelaVeiculos />);

    const card = await screen.findByRole('button', {
      name: 'Chevrolet Onix, prata · 5 lugares, placa IYK4B21',
    });
    expect(screen.getByText('prata · 5 lugares')).toBeOnTheScreen();
    expect(screen.getByText('IYK4B21')).toBeOnTheScreen();

    await fireEvent.press(card);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/veiculos/[id]', params: { id: 'v1' } });

    // O nome do botão inclui o glifo do ícone "add": procura pelo texto
    await fireEvent.press(screen.getByRole('button', { name: /Cadastrar veículo/ }));
    expect(router.push).toHaveBeenCalledWith('/veiculos/novo');
  });

  it('sem veículo, mostra o estado vazio com o cadastro', async () => {
    jest.mocked(listarMeusVeiculos).mockResolvedValue([]);
    await render(<TelaVeiculos />);

    expect(await screen.findByText('Você ainda não cadastrou nenhum veículo.')).toBeOnTheScreen();
    expect(
      screen.getByText('Para oferecer caronas, cadastre o carro que vai usar.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cadastrar veículo' })).toBeOnTheScreen();
  });

  it('com erro, mostra a mensagem e tenta de novo', async () => {
    jest
      .mocked(listarMeusVeiculos)
      .mockRejectedValueOnce(new AppError(0, 'SEM_CONEXAO', 'Sem conexão com a internet.'))
      .mockResolvedValueOnce([ONIX]);
    await render(<TelaVeiculos />);

    expect(await screen.findByText('Não foi possível carregar')).toBeOnTheScreen();
    expect(screen.getByText('Sem conexão com a internet.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Chevrolet Onix')).toBeOnTheScreen();
  });
});

describe('Novo veículo (tela 12)', () => {
  it('mostra os campos e os chips, e valida antes de cadastrar', async () => {
    await render(<TelaNovoVeiculo />);

    for (const rotulo of ['Modelo', 'Placa', 'Cor', 'Consumo na cidade, km/l (opcional)']) {
      expect(screen.getByLabelText(rotulo)).toBeOnTheScreen();
    }
    expect(screen.getByText('Lugares')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '5' })).toBeSelected();
    expect(screen.getByText('Motorização')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Outra/não sei' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Cadastrar veículo' }));

    expect(screen.getByText('Informe o modelo.')).toBeOnTheScreen();
    expect(screen.getByText('Informe a cor.')).toBeOnTheScreen();
    expect(cadastrarVeiculo).not.toHaveBeenCalled();
  });
});

describe('Editar veículo (tela 13)', () => {
  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'v1' });
  });

  it('abre preenchido, com "Salvar" e "Excluir veículo" (pede confirmação)', async () => {
    jest.mocked(obterVeiculo).mockResolvedValue(ONIX);
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<TelaEditarVeiculo />);

    expect(await screen.findByDisplayValue('Chevrolet Onix')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('IYK4B21')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /Excluir veículo/ }));
    expect(alerta).toHaveBeenCalledWith(
      'Excluir veículo',
      'Excluir Chevrolet Onix (IYK4B21)?',
      expect.any(Array),
    );
  });

  it('com erro, oferece "Tentar de novo" e "Voltar"', async () => {
    jest
      .mocked(obterVeiculo)
      .mockRejectedValue(new AppError(404, 'NAO_ENCONTRADO', 'Veículo não encontrado.'));
    await render(<TelaEditarVeiculo />);

    expect(await screen.findByText('Veículo não encontrado.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.back).toHaveBeenCalled();
  });
});
