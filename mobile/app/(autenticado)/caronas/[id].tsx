import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { detalharCarona, type CaronaDetalhe } from '@/services/caronas';
import { normalizarErro } from '@/services/erros';
import { formatarDataHoraCompleta } from '@/utils/data-hora';
import { formatarReais } from '@/utils/dinheiro';

type Carregamento =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; carona: CaronaDetalhe };

const ROTULO_STATUS: Record<CaronaDetalhe['status'], string> = {
  ABERTA: 'Aberta',
  LOTADA: 'Lotada',
  CANCELADA: 'Cancelada',
  CONCLUIDA: 'Concluída',
};

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={estilos.linha}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.valor}>{valor}</Text>
    </View>
  );
}

export default function TelaDetalheCarona() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [carregamento, setCarregamento] = useState<Carregamento>({ tipo: 'carregando' });

  useEffect(() => {
    // Ignora a resposta se a tela foi desmontada antes de ela chegar
    let ativo = true;
    const carregar = async () => {
      try {
        const carona = await detalharCarona(id);
        if (ativo) {
          setCarregamento({ tipo: 'pronto', carona });
        }
      } catch (falha) {
        if (ativo) {
          setCarregamento({ tipo: 'erro', mensagem: normalizarErro(falha).message });
        }
      }
    };
    void carregar();
    return () => {
      ativo = false;
    };
  }, [id]);

  if (carregamento.tipo === 'carregando') {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (carregamento.tipo === 'erro') {
    return (
      <View style={estilos.centro}>
        <Aviso mensagem={carregamento.mensagem} />
        <Botao titulo="Voltar" variante="secundario" onPress={() => router.back()} />
      </View>
    );
  }

  const { carona } = carregamento;

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      {carona.sou_motorista ? <Aviso tipo="info" mensagem="Esta é a sua carona." /> : null}
      {carona.status !== 'ABERTA' ? (
        <Aviso tipo="info" mensagem={`Situação: ${ROTULO_STATUS[carona.status]}.`} />
      ) : null}

      <Text style={estilos.horario}>{formatarDataHoraCompleta(carona.data_hora_partida)}</Text>
      <Text style={estilos.ajuda}>Horário de Brasília</Text>

      <Linha rotulo="Origem" valor={carona.origem} />
      <Linha rotulo="Destino" valor={carona.destino} />
      <Linha
        rotulo="Valor por passageiro"
        valor={formatarReais(carona.valorPorPassageiroCentavos)}
      />
      <Linha
        rotulo="Custo total da viagem"
        valor={`${formatarReais(carona.custoTotalCentavos)}, dividido entre motorista e passageiros`}
      />
      <Linha
        rotulo="Vagas"
        valor={`${carona.vagas_disponiveis} de ${carona.vagas_ofertadas} disponíveis`}
      />
      <Linha rotulo="Tolerância de espera" valor={`${carona.tolerancia_min} min`} />
      {carona.somente_mulheres ? <Linha rotulo="Passageiros" valor="Somente mulheres" /> : null}
      <Linha rotulo="Motorista" valor={carona.nome_motorista} />
      <Linha rotulo="Veículo" valor={`${carona.modelo} ${carona.cor} · placa ${carona.placa}`} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  conteudo: { padding: 24, gap: 16 },
  centro: { flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#fff' },
  horario: { fontSize: 20, fontWeight: '700', color: '#1f2933' },
  ajuda: { fontSize: 13, color: '#52606d', marginTop: -12 },
  linha: { gap: 2 },
  rotulo: { fontSize: 13, fontWeight: '600', color: '#52606d' },
  valor: { fontSize: 16, color: '#1f2933' },
});
