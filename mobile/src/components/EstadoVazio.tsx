import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';

import { Botao } from './Botao';
import type { NomeIcone } from './icones';

interface Props {
  icone: NomeIcone;
  titulo: string;
  mensagem: string;
  acao?: { titulo: string; icone?: NomeIcone; onPress: () => void };
}

// Lista vazia ou erro de carregamento: ícone, título, explicação e, se houver, uma ação
export function EstadoVazio({ icone, titulo, mensagem, acao }: Props) {
  return (
    <View style={estilos.container}>
      <View style={estilos.circulo}>
        <Ionicons name={icone} size={36} color={tema.cores.primaria} />
      </View>
      <Text style={estilos.titulo}>{titulo}</Text>
      <Text style={estilos.mensagem}>{mensagem}</Text>
      {acao ? (
        <Botao
          titulo={acao.titulo}
          icone={acao.icone}
          onPress={acao.onPress}
          estilo={estilos.acao}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: tema.espaco.x10,
    paddingVertical: tema.espaco.x12,
  },
  circulo: {
    width: 80,
    height: 80,
    borderRadius: tema.raio.pilula,
    backgroundColor: tema.cores.primariaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    ...tema.tipografia.subtitulo,
    color: tema.cores.texto,
    textAlign: 'center',
    marginTop: tema.espaco.x5,
  },
  mensagem: {
    ...tema.tipografia.corpo,
    color: tema.cores.textoSecundario,
    textAlign: 'center',
    marginTop: tema.espaco.x2,
  },
  acao: { marginTop: tema.espaco.x6 },
});
