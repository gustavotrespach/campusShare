import { useState, type ReactElement } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { tema } from '@/tema';
import { textoBotaoAnteriores } from '@/utils/listas';

import { Botao } from './Botao';

interface Props<T> {
  proximas: readonly T[];
  anteriores: readonly T[];
  chave: (item: T) => string;
  renderizar: (item: T) => ReactElement;
  // Estado vazio da seção "Próximas" (com a ação de oferecer ou buscar carona)
  vazio: ReactElement;
  // Leitor de tela: "Ver 1 carona anterior", "Ver 3 caronas anteriores"
  nomeDoItem: { singular: string; plural: string };
  atualizando: boolean;
  aoAtualizar: () => void;
}

interface Secao<T> {
  chave: 'proximas' | 'anteriores';
  data: readonly T[];
}

const { cores } = tema;

// "Minhas caronas" e "Minhas reservas" (T41): próximas primeiro; as anteriores começam recolhidas,
// atrás de um botão (o estado fica só em memória, enquanto a tela existe)
export function ListaPorPartida<T>({
  proximas,
  anteriores,
  chave,
  renderizar,
  vazio,
  nomeDoItem,
  atualizando,
  aoAtualizar,
}: Props<T>) {
  const [expandido, setExpandido] = useState(false);

  const secoes: Secao<T>[] = [{ chave: 'proximas', data: proximas }];
  if (anteriores.length > 0) {
    secoes.push({ chave: 'anteriores', data: expandido ? anteriores : [] });
  }

  return (
    <SectionList<T, Secao<T>>
      style={estilos.tela}
      contentContainerStyle={estilos.lista}
      sections={secoes}
      stickySectionHeadersEnabled={false}
      keyExtractor={chave}
      renderItem={({ item }) => renderizar(item)}
      ItemSeparatorComponent={() => <View style={estilos.separador} />}
      renderSectionHeader={({ section }) => {
        if (section.chave === 'proximas') {
          return proximas.length > 0 ? (
            <Text accessibilityRole="header" style={estilos.titulo}>
              Próximas
            </Text>
          ) : null;
        }
        return (
          <View style={estilos.cabecalhoAnteriores}>
            {expandido ? (
              <Text accessibilityRole="header" style={estilos.titulo}>
                Anteriores
              </Text>
            ) : null}
            <Botao
              titulo={textoBotaoAnteriores(anteriores.length, expandido)}
              icone={expandido ? 'chevron-up' : 'chevron-down'}
              variante="texto"
              accessibilityLabel={
                expandido
                  ? `Ocultar ${nomeDoItem.plural} anteriores`
                  : anteriores.length === 1
                    ? `Ver 1 ${nomeDoItem.singular} anterior`
                    : `Ver ${anteriores.length} ${nomeDoItem.plural} anteriores`
              }
              onPress={() => setExpandido((atual) => !atual)}
              estilo={estilos.botaoAnteriores}
            />
          </View>
        );
      }}
      renderSectionFooter={({ section }) =>
        section.chave === 'proximas' && proximas.length === 0 ? vazio : null
      }
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={aoAtualizar}
          tintColor={cores.primaria}
          colors={[cores.primaria]}
        />
      }
    />
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: tema.espaco.x5, flexGrow: 1 },
  separador: { height: tema.espaco.x3 },
  titulo: {
    ...tema.tipografia.subtitulo,
    color: cores.texto,
    marginBottom: tema.espaco.x3,
  },
  cabecalhoAnteriores: { marginTop: tema.espaco.x6, marginBottom: tema.espaco.x2 },
  botaoAnteriores: { alignSelf: 'flex-start', marginLeft: -tema.espaco.x2 },
});
