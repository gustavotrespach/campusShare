import { Constants, type Database } from '@/types/database';

export type Genero = Database['public']['Enums']['genero_usuario'];

// Ordem e valores vêm do enum do banco (tipos gerados); só os rótulos são do app.
export const GENEROS: readonly Genero[] = Constants.public.Enums.genero_usuario;

export const ROTULO_GENERO: Record<Genero, string> = {
  FEMININO: 'Feminino',
  MASCULINO: 'Masculino',
  OUTRO: 'Outro',
  NAO_INFORMADO: 'Prefiro não informar',
};

// Só exibição: a busca já esconde carona somente_mulheres de quem não é FEMININO e a reserva
// recusa (RN18, backend). Mostrar o filtro para quem não verá resultado só confundiria.
export function mostrarFiltroSomenteMulheres(genero: Genero | null | undefined): boolean {
  return genero === 'FEMININO';
}
