// Oferecer carona com a identidade visual (T39): seções em cards, estados de carregamento e o
// formulário completo. Os services são falsos; o valor por passageiro continua fora desta tela.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import TelaPublicarCarona from '../app/(autenticado)/caronas/publicar';
import { publicarCarona } from '@/services/caronas';
import { AppError } from '@/services/erros';
import { listarMeusVeiculos, type Veiculo } from '@/services/veiculos';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));
jest.mock('@/services/veiculos', () => ({ listarMeusVeiculos: jest.fn() }));
jest.mock('@/services/caronas', () => ({ publicarCarona: jest.fn() }));
jest.mock('@/services/localizacao', () => ({ obterLocalizacaoAtual: jest.fn() }));

const ONIX = {
  id_veiculo: 'v1',
  modelo: 'Onix',
  placa: 'IYK4B21',
  cor: 'Prata',
  qtd_lugares: 5,
  motorizacao: '1.0',
  consumo_kml: 12.5,
} as Veiculo;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Oferecer carona (tela 7)', () => {
  it('mostra as seções, os campos e o botão de publicar', async () => {
    jest.mocked(listarMeusVeiculos).mockResolvedValue([ONIX]);
    await render(<TelaPublicarCarona />);

    for (const secao of ['Carro', 'Trajeto', 'Quando', 'Vagas e valor']) {
      expect(await screen.findByRole('header', { name: secao })).toBeOnTheScreen();
    }
    expect(screen.getByRole('radio', { name: 'Onix · IYK4B21' })).toBeSelected();
    expect(screen.getByLabelText('Descrição da origem')).toBeOnTheScreen();
    expect(screen.getByLabelText('Descrição do destino')).toBeOnTheScreen();
    expect(screen.getByText('Partida')).toBeOnTheScreen();
    expect(screen.getByText('Vagas para passageiros')).toBeOnTheScreen();
    expect(screen.getByLabelText('Custo total da viagem (R$)')).toBeOnTheScreen();
    expect(screen.getByText('Tolerância de espera')).toBeOnTheScreen();
    expect(screen.getByLabelText('Carona somente para mulheres')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Publicar carona' })).toBeOnTheScreen();
    // Quem calcula o valor por passageiro é o backend (ADR-005): só a explicação aparece aqui
    expect(screen.queryByText(/por passageiro: R\$/)).toBeNull();
  });

  it('sem o custo, mostra o erro no campo e não publica', async () => {
    jest.mocked(listarMeusVeiculos).mockResolvedValue([ONIX]);
    await render(<TelaPublicarCarona />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Publicar carona' }));

    expect(screen.getByText('Informe o custo total da viagem.')).toBeOnTheScreen();
    expect(publicarCarona).not.toHaveBeenCalled();
  });

  it('sem veículo, pede o cadastro de um', async () => {
    jest.mocked(listarMeusVeiculos).mockResolvedValue([]);
    await render(<TelaPublicarCarona />);

    expect(await screen.findByText('Cadastre um veículo primeiro')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cadastrar veículo' }));
    expect(router.push).toHaveBeenCalledWith('/veiculos/novo');
  });

  it('com erro ao carregar os veículos, mostra a mensagem e tenta de novo', async () => {
    jest
      .mocked(listarMeusVeiculos)
      .mockRejectedValueOnce(new AppError(0, 'SEM_CONEXAO', 'Sem conexão com a internet.'))
      .mockResolvedValueOnce([ONIX]);
    await render(<TelaPublicarCarona />);

    expect(await screen.findByText('Sem conexão com a internet.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('button', { name: 'Publicar carona' })).toBeOnTheScreen();
  });
});
