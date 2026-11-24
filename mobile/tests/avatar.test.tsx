// T44 — Avatar com foto: a imagem do Storage (URL autenticada do service) quando há foto; as
// iniciais sem foto, se a imagem falhar ou se não der para montar a URL.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Avatar } from '@/components/Avatar';
import { AppError } from '@/services/erros';
import { urlFotoPerfil } from '@/services/foto-perfil';

jest.mock('@/services/foto-perfil', () => ({ urlFotoPerfil: jest.fn() }));

// Sem onPress o avatar é decorativo (escondido do leitor de tela): as consultas incluem ocultos
const OCULTOS = { includeHiddenElements: true };

const CAMINHO = 'u1/avatar.jpg?v=1795521600';
const FONTE = {
  uri: `http://127.0.0.1:54321/storage/v1/object/authenticated/fotos-perfil/${CAMINHO}`,
  headers: { Authorization: 'Bearer token', apikey: 'chave' },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(urlFotoPerfil).mockResolvedValue(FONTE);
});

describe('Avatar', () => {
  it('sem foto: as iniciais, sem pedir URL', async () => {
    await render(<Avatar nome="Mariana Souza" fotoCaminho={null} />);

    expect(screen.getByText('MS', OCULTOS)).toBeOnTheScreen();
    expect(screen.queryByTestId('avatar-foto', OCULTOS)).toBeNull();
    expect(urlFotoPerfil).not.toHaveBeenCalled();
  });

  it('com foto: a imagem do endpoint autenticado, com o token nos cabeçalhos', async () => {
    await render(<Avatar nome="Mariana Souza" fotoCaminho={CAMINHO} tamanho={72} />);

    const imagem = await screen.findByTestId('avatar-foto', OCULTOS);
    expect(urlFotoPerfil).toHaveBeenCalledWith(CAMINHO);
    expect(imagem).toHaveProp('source', FONTE);
    expect(imagem).toHaveStyle({ width: 72, height: 72, borderRadius: 36 });
    expect(screen.queryByText('MS', OCULTOS)).toBeNull();
  });

  it('a imagem falhou (rede, arquivo apagado): volta às iniciais', async () => {
    await render(<Avatar nome="Mariana Souza" fotoCaminho={CAMINHO} />);

    await fireEvent(await screen.findByTestId('avatar-foto', OCULTOS), 'error');

    expect(screen.queryByTestId('avatar-foto', OCULTOS)).toBeNull();
    expect(screen.getByText('MS', OCULTOS)).toBeOnTheScreen();
  });

  it('sem sessão para montar a URL: as iniciais', async () => {
    jest
      .mocked(urlFotoPerfil)
      .mockRejectedValue(new AppError(401, 'NAO_AUTENTICADO', 'Sua sessão expirou.'));
    await render(<Avatar nome="Mariana Souza" fotoCaminho={CAMINHO} />);

    expect(urlFotoPerfil).toHaveBeenCalled();
    expect(screen.getByText('MS', OCULTOS)).toBeOnTheScreen();
    expect(screen.queryByTestId('avatar-foto', OCULTOS)).toBeNull();
  });

  it('como botão, o accessibilityLabel não muda com a foto', async () => {
    const aoTocar = jest.fn();
    await render(
      <Avatar
        nome="Mariana"
        fotoCaminho={CAMINHO}
        accessibilityLabel="Meu perfil"
        onPress={aoTocar}
      />,
    );

    await screen.findByTestId('avatar-foto', OCULTOS);
    await fireEvent.press(screen.getByRole('button', { name: 'Meu perfil' }));
    expect(aoTocar).toHaveBeenCalledTimes(1);
  });

  it('trocar a foto (novo ?v=) pede a URL nova', async () => {
    const { rerender } = await render(<Avatar nome="Mariana" fotoCaminho={CAMINHO} />);
    await screen.findByTestId('avatar-foto', OCULTOS);

    await rerender(<Avatar nome="Mariana" fotoCaminho="u1/avatar.jpg?v=1795600000" />);

    await screen.findByTestId('avatar-foto', OCULTOS);
    expect(urlFotoPerfil).toHaveBeenLastCalledWith('u1/avatar.jpg?v=1795600000');
  });
});
