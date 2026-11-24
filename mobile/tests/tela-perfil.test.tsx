// Meu perfil com a identidade visual (T39): topo com avatar e selo, card "Seus dados", atalhos,
// "Sair" e o status do servidor. Os services são falsos.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import TelaPerfil from '../app/(autenticado)/perfil';
import { sair } from '@/services/auth';
import { AppError } from '@/services/erros';
import { atualizarPerfil, obterMeuPerfil, type MeuPerfil } from '@/services/perfil';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock('@/services/auth', () => ({ sair: jest.fn() }));
jest.mock('@/services/perfil', () => ({ obterMeuPerfil: jest.fn(), atualizarPerfil: jest.fn() }));
jest.mock('@/services/sistema', () => ({ verificarSaude: jest.fn(async () => 'ok') }));

const PERFIL: MeuPerfil = {
  nome_completo: 'Mariana Souza',
  email_institucional: 'mariana.souza@rede.ulbra.br',
  genero: 'FEMININO',
  telefone: '51999999999',
  instituicao: 'Universidade Luterana do Brasil (ULBRA)',
} as MeuPerfil;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Meu perfil (tela 10)', () => {
  it('mostra o topo, os dados, os atalhos, o "Sair" e o servidor', async () => {
    jest.mocked(obterMeuPerfil).mockResolvedValue(PERFIL);
    await render(<TelaPerfil />);

    expect(await screen.findByText('E-mail institucional confirmado')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Seus dados' })).toBeOnTheScreen();
    expect(screen.getByDisplayValue('mariana.souza@rede.ulbra.br')).toBeOnTheScreen();
    expect(screen.getByLabelText('E-mail institucional')).toHaveProp('editable', false);
    expect(screen.getByDisplayValue('Universidade Luterana do Brasil (ULBRA)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nome completo')).toHaveDisplayValue('Mariana Souza');
    expect(screen.getByLabelText('Telefone (opcional)')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Feminino' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeOnTheScreen();
    expect(await screen.findByText('Servidor: ok')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /Meus veículos/ }));
    expect(router.push).toHaveBeenCalledWith('/veiculos');
    await fireEvent.press(screen.getByRole('button', { name: /Minhas caronas/ }));
    expect(router.push).toHaveBeenCalledWith('/caronas/minhas');
    await fireEvent.press(screen.getByRole('button', { name: /Minhas reservas/ }));
    expect(router.push).toHaveBeenCalledWith('/reservas');
    await fireEvent.press(screen.getByRole('button', { name: /Sair/ }));
    expect(sair).toHaveBeenCalled();
  });

  it('nome vazio mostra o erro do campo e não salva', async () => {
    jest.mocked(obterMeuPerfil).mockResolvedValue(PERFIL);
    await render(<TelaPerfil />);

    await fireEvent.changeText(await screen.findByLabelText('Nome completo'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Informe seu nome completo.')).toBeOnTheScreen();
    expect(atualizarPerfil).not.toHaveBeenCalled();
  });

  it('com erro, mostra a mensagem e mantém os atalhos e o "Sair"', async () => {
    jest
      .mocked(obterMeuPerfil)
      .mockRejectedValue(new AppError(0, 'SEM_CONEXAO', 'Sem conexão com a internet.'));
    await render(<TelaPerfil />);

    expect(await screen.findByText('Sem conexão com a internet.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Meus veículos/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Sair/ })).toBeOnTheScreen();
  });
});
