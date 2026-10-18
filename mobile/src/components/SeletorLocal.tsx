import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CampoTexto } from '@/components/CampoTexto';
import { SeletorOpcoes, type Opcao } from '@/components/SeletorOpcoes';
import { normalizarErro } from '@/services/erros';
import { obterLocalizacaoAtual } from '@/services/localizacao';
import { ID_MINHA_LOCALIZACAO, PONTOS_FIXOS, pontoPorId, type Local } from '@/utils/pontos';
import { tema } from '@/tema';

const OPCOES: Opcao<string>[] = [
  ...PONTOS_FIXOS.map((ponto) => ({ valor: ponto.id, rotulo: ponto.rotulo })),
  { valor: ID_MINHA_LOCALIZACAO, rotulo: 'Minha localização' },
];

interface Props {
  rotulo: string;
  idInicial: string;
  valor: Local | null;
  aoMudar: (local: Local) => void;
  erro?: string;
}

// Origem ou destino sem mapa (T27): um ponto fixo ou a localização atual, mais a descrição que o
// passageiro vai ler (editável; na localização atual começa vazia para o motorista descrever).
export function SeletorLocal({ rotulo, idInicial, valor, aoMudar, erro }: Props) {
  const [selecionado, setSelecionado] = useState(idInicial);
  const [localizando, setLocalizando] = useState(false);
  const [avisoLocalizacao, setAvisoLocalizacao] = useState<string | null>(null);

  const aoEscolher = async (id: string) => {
    setAvisoLocalizacao(null);
    if (id !== ID_MINHA_LOCALIZACAO) {
      const ponto = pontoPorId(id);
      if (ponto) {
        setSelecionado(id);
        aoMudar({
          descricao: ponto.descricao,
          latitude: ponto.latitude,
          longitude: ponto.longitude,
        });
      }
      return;
    }
    setLocalizando(true);
    try {
      const coordenadas = await obterLocalizacaoAtual();
      setSelecionado(id);
      aoMudar({ descricao: '', ...coordenadas });
    } catch (falha) {
      // Mantém o ponto anterior
      setAvisoLocalizacao(normalizarErro(falha).message);
    } finally {
      setLocalizando(false);
    }
  };

  return (
    <View style={estilos.container}>
      <SeletorOpcoes
        rotulo={rotulo}
        opcoes={OPCOES}
        valor={selecionado}
        aoMudar={(id) => void aoEscolher(id)}
      />
      {localizando ? <Text style={estilos.ajuda}>Obtendo sua localização…</Text> : null}
      {avisoLocalizacao ? <Text style={estilos.aviso}>{avisoLocalizacao}</Text> : null}
      <CampoTexto
        rotulo={`Descrição da ${rotulo.toLowerCase()}`}
        value={valor?.descricao ?? ''}
        onChangeText={(descricao) => {
          if (valor) {
            aoMudar({ ...valor, descricao });
          }
        }}
        erro={erro}
        editable={valor !== null}
        placeholder="Ex.: Rua da Praia, 100 — em frente à padaria"
        maxLength={200}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: 8 },
  ajuda: { fontSize: 13, color: tema.cores.textoSecundario },
  aviso: { fontSize: 13, color: tema.cores.erro },
});
