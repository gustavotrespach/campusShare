// Navegação entre as rotas autenticadas e públicas quando a sessão muda (T37). Monta a árvore real
// de app/: os _layout.tsx são os de verdade (guards do Stack.Protected) e cada tela vira um texto
// com o próprio nome, para o teste não depender do Supabase. A sessão vem de um provedor falso que
// o teste troca na hora, como o observarSessao faz quando o sair() apaga a sessão.
import type { ComponentType, ReactNode } from 'react';
import { Text } from 'react-native';
import { act, getMockContext, renderRouter, screen, waitFor } from 'expo-router/testing-library';

type Sessao = { user: { id: string } } | null;

const mockEstadoSessao: { sessao: Sessao; ouvintes: Set<() => void> } = {
  sessao: null,
  ouvintes: new Set(),
};

jest.mock('@/store/sessao', () => {
  const { useSyncExternalStore: usarLoja } = jest.requireActual<typeof import('react')>('react');
  const assinar = (ouvinte: () => void) => {
    mockEstadoSessao.ouvintes.add(ouvinte);
    return () => mockEstadoSessao.ouvintes.delete(ouvinte);
  };
  return {
    ProvedorSessao: ({ children }: { children: ReactNode }) => children,
    useSessao: () => ({
      sessao: usarLoja(assinar, () => mockEstadoSessao.sessao),
      carregando: false,
    }),
  };
});

function definirSessao(sessao: Sessao) {
  mockEstadoSessao.sessao = sessao;
  mockEstadoSessao.ouvintes.forEach((ouvinte) => ouvinte());
}

const LOGADO: Sessao = { user: { id: 'b0000000-0000-0000-0000-00000000000b' } };

function telaFalsa(rota: string): ComponentType {
  return function Tela() {
    return <Text>{`tela ${rota}`}</Text>;
  };
}

// Lê a pasta app/ de verdade (o require de cada arquivo só acontece quando pedido), para o teste
// acompanhar rotas novas sem lista escrita à mão. './(autenticado)/perfil.tsx' → '(autenticado)/perfil'
function arvoreDoApp(): Record<string, ComponentType> {
  const app = getMockContext('app');
  return Object.fromEntries(
    app.keys().map((arquivo) => {
      const rota = arquivo.replace(/^\.\//, '').replace(/\.tsx?$/, '');
      return [
        rota,
        rota.endsWith('_layout')
          ? // Layouts reais: são eles que decidem para onde a navegação vai
            (app(arquivo) as { default: ComponentType }).default
          : telaFalsa(rota),
      ];
    }),
  );
}

beforeEach(() => {
  mockEstadoSessao.sessao = null;
  mockEstadoSessao.ouvintes.clear();
});

describe('sessão e navegação (T37)', () => {
  it.each([
    ['/perfil', '(autenticado)/perfil'],
    ['/', '(autenticado)/index'],
    ['/veiculos', '(autenticado)/veiculos/index'],
  ])('logado em %s, a sessão some (Sair) e o app vai para o login', async (url, tela) => {
    definirSessao(LOGADO);
    await renderRouter(arvoreDoApp(), { initialUrl: url });
    expect(screen).toHavePathname(url);
    expect(screen.getByText(`tela ${tela}`)).toBeTruthy();

    // O guard redireciona por um <Redirect> que só age depois do foco: o waitFor avança os timers
    await act(async () => definirSessao(null));

    await waitFor(() => expect(screen).toHavePathname('/entrar'));
    expect(screen.getByText('tela (publico)/entrar')).toBeTruthy();
    expect(screen.queryByText(/Unmatched Route/)).toBeNull();
  });

  it('abrir o app sem sessão abre no login', async () => {
    await renderRouter(arvoreDoApp(), { initialUrl: '/' });

    await waitFor(() => expect(screen).toHavePathname('/entrar'));
    expect(screen.getByText('tela (publico)/entrar')).toBeTruthy();
  });

  it('entrar leva a "Caronas próximas"', async () => {
    await renderRouter(arvoreDoApp(), { initialUrl: '/entrar' });
    expect(screen).toHavePathname('/entrar');

    await act(async () => definirSessao(LOGADO));

    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(screen.getByText('tela (autenticado)/index')).toBeTruthy();
  });

  it('o link de confirmação abre com ou sem sessão', async () => {
    await renderRouter(arvoreDoApp(), { initialUrl: '/confirmacao' });
    expect(screen).toHavePathname('/confirmacao');
  });
});
