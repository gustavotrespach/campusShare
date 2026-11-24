// Meu perfil com a identidade visual (T39): topo com avatar e selo, card "Seus dados", atalhos,
// "Sair" e o status do servidor. Os services são falsos.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { router } from 'expo-router';

import TelaPerfil from '../app/(autenticado)/perfil';
import { sair } from '@/services/auth';
import { AppError } from '@/services/erros';
import { obterPerfilPublico } from '@/services/avaliacoes';
import {
  enviarFotoPerfil,
  escolherFotoDaGaleria,
  removerFotoPerfil,
  urlFotoPerfil,
} from '@/services/foto-perfil';
import { atualizarPerfil, obterMeuPerfil, type MeuPerfil } from '@/services/perfil';

jest.mock('expo-router', () => require('./apoio/expo-router-falso'));
jest.mock('@/services/auth', () => ({ sair: jest.fn() }));
jest.mock('@/services/perfil', () => ({ obterMeuPerfil: jest.fn(), atualizarPerfil: jest.fn() }));
jest.mock('@/services/sistema', () => ({ verificarSaude: jest.fn(async () => 'ok') }));
jest.mock('@/services/avaliacoes', () => ({ obterPerfilPublico: jest.fn() }));
jest.mock('@/services/foto-perfil', () => ({
  enviarFotoPerfil: jest.fn(),
  escolherFotoDaGaleria: jest.fn(),
  removerFotoPerfil: jest.fn(),
  urlFotoPerfil: jest.fn(),
}));
jest.mock('@/store/sessao', () => ({
  useSessao: () => ({ sessao: { user: { id: 'u1' } }, carregando: false }),
}));

const PERFIL: MeuPerfil = {
  nome_completo: 'Mariana Souza',
  email_institucional: 'mariana.souza@rede.ulbra.br',
  genero: 'FEMININO',
  telefone: '51999999999',
  instituicao: 'Universidade Luterana do Brasil (ULBRA)',
} as MeuPerfil;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(obterPerfilPublico).mockResolvedValue({
    idUsuario: 'u1',
    nome: 'Mariana Souza',
    media: 4.8,
    total: 5,
    fotoCaminho: null,
  });
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
    await fireEvent.press(screen.getByRole('button', { name: /Avaliações pendentes/ }));
    expect(router.push).toHaveBeenCalledWith('/avaliacoes');
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

  it('mostra a própria média no topo (perfil público do usuário logado)', async () => {
    jest.mocked(obterMeuPerfil).mockResolvedValue(PERFIL);
    await render(<TelaPerfil />);

    expect(await screen.findByText('4,8 · 5 avaliações')).toBeOnTheScreen();
    expect(obterPerfilPublico).toHaveBeenCalledWith('u1');
  });

  it('sem avaliações: "Sem avaliações ainda"; se falhar, o topo só não mostra a média', async () => {
    jest.mocked(obterMeuPerfil).mockResolvedValue(PERFIL);
    jest.mocked(obterPerfilPublico).mockResolvedValueOnce({
      idUsuario: 'u1',
      nome: 'Mariana',
      media: null,
      total: 0,
      fotoCaminho: null,
    });
    const primeira = await render(<TelaPerfil />);
    expect(await screen.findByText('Sem avaliações ainda')).toBeOnTheScreen();
    await primeira.unmount();

    jest.mocked(obterPerfilPublico).mockRejectedValueOnce(new Error('rede'));
    await render(<TelaPerfil />);
    expect(await screen.findByText('E-mail institucional confirmado')).toBeOnTheScreen();
    expect(screen.queryByText(/avaliaç/)).toBeNull();
  });
});

describe('Foto de perfil (T44)', () => {
  const COM_FOTO = {
    idUsuario: 'u1',
    nome: 'Mariana Souza',
    media: 4.8,
    total: 5,
    fotoCaminho: 'u1/avatar.jpg?v=1795521600',
  };
  const SEM_FOTO = { ...COM_FOTO, fotoCaminho: null };
  const OCULTOS = { includeHiddenElements: true };

  function responderAlerta(texto: string) {
    return jest.spyOn(Alert, 'alert').mockImplementation((_titulo, _mensagem, botoes) => {
      (botoes as AlertButton[]).find((botao) => botao.text === texto)?.onPress?.();
    });
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.mocked(obterMeuPerfil).mockResolvedValue(PERFIL);
    jest.mocked(urlFotoPerfil).mockResolvedValue({
      uri: 'http://127.0.0.1:54321/storage/v1/object/authenticated/fotos-perfil/u1/avatar.jpg?v=1795521600',
      headers: { Authorization: 'Bearer token', apikey: 'chave' },
    });
  });

  async function abrir() {
    await render(<TelaPerfil />);
    await screen.findByText('E-mail institucional confirmado');
  }

  it('sem foto: iniciais, "Alterar foto", nenhum "Remover foto" e a frase de privacidade', async () => {
    jest.mocked(obterPerfilPublico).mockResolvedValue(SEM_FOTO);
    await abrir();

    expect(await screen.findByRole('button', { name: /Alterar foto/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Remover foto/ })).toBeNull();
    expect(
      screen.getByText('Sua foto aparece só para quem está logado no CampusShare.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('avatar-foto', OCULTOS)).toBeNull();
  });

  it('com foto: mostra a imagem e o "Remover foto"', async () => {
    jest.mocked(obterPerfilPublico).mockResolvedValue(COM_FOTO);
    await abrir();

    expect(await screen.findByTestId('avatar-foto', OCULTOS)).toBeOnTheScreen();
    expect(urlFotoPerfil).toHaveBeenCalledWith('u1/avatar.jpg?v=1795521600');
    expect(await screen.findByRole('button', { name: /Remover foto/ })).toBeOnTheScreen();
  });

  it('alterar: escolhe na galeria, envia e relê o perfil com a foto nova', async () => {
    jest.mocked(obterPerfilPublico).mockResolvedValueOnce(SEM_FOTO).mockResolvedValue(COM_FOTO);
    jest.mocked(escolherFotoDaGaleria).mockResolvedValue('file:///galeria/foto.jpg');
    jest.mocked(enviarFotoPerfil).mockResolvedValue();
    await abrir();

    await fireEvent.press(await screen.findByRole('button', { name: /Alterar foto/ }));

    expect(enviarFotoPerfil).toHaveBeenCalledWith('file:///galeria/foto.jpg');
    expect(await screen.findByText('Foto atualizada.')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: /Remover foto/ })).toBeOnTheScreen();
    expect(obterPerfilPublico).toHaveBeenCalledTimes(2);
  });

  it('cancelar a escolha não envia nada nem mostra aviso', async () => {
    jest.mocked(obterPerfilPublico).mockResolvedValue(SEM_FOTO);
    jest.mocked(escolherFotoDaGaleria).mockResolvedValue(null);
    await abrir();

    await fireEvent.press(await screen.findByRole('button', { name: /Alterar foto/ }));

    expect(escolherFotoDaGaleria).toHaveBeenCalled();
    expect(enviarFotoPerfil).not.toHaveBeenCalled();
    expect(screen.queryByText('Foto atualizada.')).toBeNull();
  });

  it('erro ao enviar: Aviso com a frase do service', async () => {
    jest.mocked(obterPerfilPublico).mockResolvedValue(SEM_FOTO);
    jest.mocked(escolherFotoDaGaleria).mockResolvedValue('file:///galeria/foto.jpg');
    jest
      .mocked(enviarFotoPerfil)
      .mockRejectedValue(
        new AppError(413, 'FOTO_GRANDE', 'Essa foto ficou grande demais. Escolha outra imagem.'),
      );
    await abrir();

    await fireEvent.press(await screen.findByRole('button', { name: /Alterar foto/ }));

    expect(
      await screen.findByText('Essa foto ficou grande demais. Escolha outra imagem.'),
    ).toBeOnTheScreen();
  });

  it('sem acesso às fotos: Aviso com onde liberar', async () => {
    jest.mocked(obterPerfilPublico).mockResolvedValue(SEM_FOTO);
    jest
      .mocked(escolherFotoDaGaleria)
      .mockRejectedValue(
        new AppError(403, 'GALERIA_NEGADA', 'Sem acesso às suas fotos. Permita o acesso.'),
      );
    await abrir();

    await fireEvent.press(await screen.findByRole('button', { name: /Alterar foto/ }));

    expect(
      await screen.findByText('Sem acesso às suas fotos. Permita o acesso.'),
    ).toBeOnTheScreen();
    expect(enviarFotoPerfil).not.toHaveBeenCalled();
  });

  it('remover pede confirmação; "Remover" apaga e volta às iniciais', async () => {
    jest.mocked(obterPerfilPublico).mockResolvedValueOnce(COM_FOTO).mockResolvedValue(SEM_FOTO);
    jest.mocked(removerFotoPerfil).mockResolvedValue();
    const alerta = responderAlerta('Remover');
    await abrir();

    await fireEvent.press(await screen.findByRole('button', { name: /Remover foto/ }));

    expect(alerta).toHaveBeenCalledWith(
      'Remover foto?',
      'Sua foto sai do perfil e as iniciais voltam a aparecer.',
      expect.any(Array),
    );
    expect(removerFotoPerfil).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Foto removida.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Remover foto/ })).toBeNull();
  });

  it('remover e "Cancelar": nada muda', async () => {
    jest.mocked(obterPerfilPublico).mockResolvedValue(COM_FOTO);
    responderAlerta('Cancelar');
    await abrir();

    await fireEvent.press(await screen.findByRole('button', { name: /Remover foto/ }));

    expect(removerFotoPerfil).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Remover foto/ })).toBeOnTheScreen();
  });
});
