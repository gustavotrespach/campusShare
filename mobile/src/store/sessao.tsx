import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { obterSessao, observarSessao, type Sessao } from '@/services/auth';

interface EstadoSessao {
  sessao: Sessao | null;
  // true até ler a sessão salva no SecureStore: evita piscar a tela de login ao reabrir o app
  carregando: boolean;
}

const ContextoSessao = createContext<EstadoSessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>({ sessao: null, carregando: true });

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      let sessao: Sessao | null = null;
      try {
        sessao = await obterSessao();
      } catch {
        // Sessão ilegível ou .env ausente: segue deslogado; a tela de login mostra o erro ao entrar.
      }
      if (ativo) {
        setEstado({ sessao, carregando: false });
      }
    };
    void carregar();

    let cancelar: (() => void) | undefined;
    try {
      cancelar = observarSessao((sessao) => setEstado({ sessao, carregando: false }));
    } catch {
      // Sem configuração do Supabase não há o que observar.
    }
    return () => {
      ativo = false;
      cancelar?.();
    };
  }, []);

  return <ContextoSessao.Provider value={estado}>{children}</ContextoSessao.Provider>;
}

export function useSessao(): EstadoSessao {
  const contexto = useContext(ContextoSessao);
  if (!contexto) {
    throw new Error('useSessao precisa estar dentro de <ProvedorSessao>.');
  }
  return contexto;
}
