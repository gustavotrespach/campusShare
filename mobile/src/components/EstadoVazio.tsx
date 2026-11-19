import { StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';

import { Botao } from './Botao';
import { IconeEmCirculo } from './IconeEmCirculo';
import type { NomeIcone } from './icones';

interface Props {
  icone: NomeIcone;
  titulo: string;
  mensagem: string;
  acao?: { titulo: string; icone?: NomeIcone; onPress: () => void };
  // Botão de texto abaixo da ação principal (ex.: "Voltar" no erro de carregamento)
  acaoSecundaria?: { titulo: string; onPress: () => void };
}

// Lista vazia ou erro de carregamento: ícone, título, explicação e, se houver, uma ação
export function EstadoVazio({ icone, titulo, mensagem, acao, acaoSecundaria }: Props) {
  return (
    <View style={estilos.container}>
      <IconeEmCirculo icone={icone} />
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
      {acaoSecundaria ? (
        <Botao
          titulo={acaoSecundaria.titulo}
          variante="texto"
          onPress={acaoSecundaria.onPress}
          estilo={estilos.acaoSecundaria}
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
  acaoSecundaria: { marginTop: tema.espaco.x2 },
});
