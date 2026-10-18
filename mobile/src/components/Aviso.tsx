import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';

import { Botao } from './Botao';
import type { NomeIcone } from './icones';

type Tipo = 'erro' | 'sucesso' | 'info';

interface Props {
  mensagem: string;
  tipo?: Tipo;
  acao?: { titulo: string; onPress: () => void };
}

const { cores } = tema;

const VISUAL: Record<Tipo, { fundo: string; cor: string; icone: NomeIcone }> = {
  info: { fundo: cores.infoClaro, cor: cores.info, icone: 'information-circle' },
  sucesso: { fundo: cores.sucessoClaro, cor: cores.sucesso, icone: 'checkmark-circle' },
  erro: { fundo: cores.erroClaro, cor: cores.erro, icone: 'alert-circle' },
};

export function Aviso({ mensagem, tipo = 'erro', acao }: Props) {
  const visual = VISUAL[tipo];
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[estilos.caixa, { backgroundColor: visual.fundo, borderLeftColor: visual.cor }]}
    >
      <Ionicons name={visual.icone} size={20} color={visual.cor} />
      <View style={estilos.corpo}>
        <Text style={[estilos.texto, { color: visual.cor }]}>{mensagem}</Text>
        {acao ? (
          <Botao
            titulo={acao.titulo}
            variante="texto"
            onPress={acao.onPress}
            estilo={estilos.acao}
          />
        ) : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: tema.raio.medio,
    borderLeftWidth: 4,
    paddingVertical: tema.espaco.x3,
    paddingHorizontal: 14,
    gap: 10,
  },
  corpo: { flex: 1, gap: tema.espaco.x1 },
  texto: { ...tema.tipografia.apoio },
  acao: { alignSelf: 'flex-start', paddingHorizontal: tema.espaco.x2, marginLeft: -8 },
});
