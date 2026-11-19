import { GENEROS, ROTULO_GENERO, type Genero } from '@/utils/genero';

import { SeletorOpcoes, type Opcao } from './SeletorOpcoes';

interface Props {
  valor: Genero | null;
  aoMudar: (genero: Genero) => void;
  erro?: string;
}

const OPCOES: Opcao<Genero>[] = GENEROS.map((genero) => ({
  valor: genero,
  rotulo: ROTULO_GENERO[genero],
}));

// Chips do DESIGN.md (3.9); sem escolha (cadastro), nenhum chip começa marcado
export function SeletorGenero({ valor, aoMudar, erro }: Props) {
  return (
    <SeletorOpcoes<Genero | null>
      rotulo="Gênero"
      ajuda="Usado só no filtro de caronas “somente mulheres”."
      opcoes={OPCOES}
      valor={valor}
      aoMudar={(genero) => {
        if (genero !== null) {
          aoMudar(genero);
        }
      }}
      erro={erro}
    />
  );
}
