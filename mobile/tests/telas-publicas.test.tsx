// Telas públicas com a identidade visual (T39): Cadastro, Confira seu e-mail e Confirmação.
// Os services são falsos: o teste confere que campos, botões e mensagens continuam na tela.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import TelaCadastro from '../app/(publico)/cadastro';
import TelaConfiraEmail from '../app/(publico)/confira-email';
import TelaConfirmacao from '../app/confirmacao';
import { cadastrar } from '@/services/auth';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@/services/auth', () => ({
  cadastrar: jest.fn(),
  reenviarConfirmacao: jest.fn(),
  confirmarPorLink: jest.fn(() => new Promise(() => {})),
  MENSAGEM_LINK_INVALIDO: 'Este link de confirmação não é válido.',
}));

const mockUrl: { atual: string | null } = { atual: null };
jest.mock('expo-linking', () => ({ useLinkingURL: () => mockUrl.atual }));

const mockSessao: { sessao: object | null } = { sessao: null };
jest.mock('@/store/sessao', () => ({ useSessao: () => ({ sessao: mockSessao.sessao }) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockUrl.atual = null;
  mockSessao.sessao = null;
});

describe('Cadastro (tela 2)', () => {
  it('mostra os campos, o gênero e os botões', async () => {
    await render(<TelaCadastro />);

    expect(screen.getByRole('header', { name: 'Criar conta' })).toBeOnTheScreen();
    for (const rotulo of [
      'Nome completo',
      'E-mail institucional',
      'Senha (mínimo 8 caracteres)',
      'Telefone (opcional)',
    ]) {
      expect(screen.getByLabelText(rotulo)).toBeOnTheScreen();
    }
    expect(screen.getByText('Só e-mails @rede.ulbra.br podem criar conta.')).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'Prefiro não informar' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Já tenho conta' })).toBeOnTheScreen();
  });

  it('formulário vazio mostra os erros de campo e não chama o cadastro', async () => {
    await render(<TelaCadastro />);

    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByText('Informe seu nome completo.')).toBeOnTheScreen();
    expect(screen.getByText('Informe seu e-mail.')).toBeOnTheScreen();
    expect(cadastrar).not.toHaveBeenCalled();
  });

  it('"Já tenho conta" volta ao login', async () => {
    await render(<TelaCadastro />);

    await fireEvent.press(screen.getByRole('button', { name: 'Já tenho conta' }));

    expect(router.back).toHaveBeenCalled();
  });
});

describe('Confira seu e-mail (tela 3)', () => {
  it('mostra o e-mail, o reenvio em espera e o "Voltar ao login"', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ email: 'ana@rede.ulbra.br' });
    await render(<TelaConfiraEmail />);

    expect(screen.getByRole('header', { name: 'Confira seu e-mail' })).toBeOnTheScreen();
    expect(screen.getByText('ana@rede.ulbra.br')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reenviar link (60s)' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao login' }));
    expect(router.replace).toHaveBeenCalledWith('/entrar');
  });
});

describe('Confirmação (tela 4)', () => {
  it('com o link, mostra que está confirmando', async () => {
    mockUrl.atual = 'campusshare://confirmacao#access_token=x';
    await render(<TelaConfirmacao />);

    expect(screen.getByText('Confirmando seu e-mail…')).toBeOnTheScreen();
  });

  it('sem link válido, mostra o erro, o campo de e-mail e o reenvio', async () => {
    await render(<TelaConfirmacao />);

    expect(screen.getByRole('header', { name: 'Não foi possível confirmar' })).toBeOnTheScreen();
    expect(screen.getByText('Este link de confirmação não é válido.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Seu e-mail institucional')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reenviar link' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voltar ao login' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Reenviar link' }));
    expect(screen.getByText('Informe seu e-mail.')).toBeOnTheScreen();
  });

  it('com sessão, a saída é "Ir para o início"', async () => {
    mockSessao.sessao = { user: { id: 'u1' } };
    await render(<TelaConfirmacao />);

    await fireEvent.press(screen.getByRole('button', { name: 'Ir para o início' }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
