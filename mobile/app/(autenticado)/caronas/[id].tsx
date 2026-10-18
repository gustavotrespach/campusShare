import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { EstadoVazio } from '@/components/EstadoVazio';
import type { NomeIcone } from '@/components/icones';
import { LinhaRota } from '@/components/LinhaRota';
import { Placa } from '@/components/Placa';
import { SeloStatus } from '@/components/SeloStatus';
import { detalharCarona, type CaronaDetalhe } from '@/services/caronas';
import { normalizarErro } from '@/services/erros';
import { reservarVaga } from '@/services/reservas';
import { guardarPix } from '@/store/pix';
import { tema } from '@/tema';
import { formatarDataLonga, formatarHora } from '@/utils/data-hora';
import { formatarReais } from '@/utils/dinheiro';
import { descreverVeiculo } from '@/utils/exibicao-carona';
import { atalhoDoErroDeReserva, podeReservar } from '@/utils/reserva';

interface ErroReserva {
  mensagem: string;
  atalho: 'minhas_reservas' | null;
}

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

const { cores } = tema;

// Altura aproximada da barra inferior: o fim da rolagem não fica embaixo dela
const ALTURA_BARRA = 84;

function LinhaComIcone({ icone, texto }: { icone: NomeIcone; texto: string }) {
  return (
    <View style={estilos.linhaComIcone}>
      <Ionicons name={icone} size={18} color={cores.primaria} />
      <Text style={estilos.apoio}>{texto}</Text>
    </View>
  );
}

function CartaoInfo({ icone, rotulo, valor }: { icone: NomeIcone; rotulo: string; valor: string }) {
  return (
    <View style={[estilos.cartao, estilos.cartaoInfo]}>
      <Ionicons name={icone} size={22} color={cores.primaria} />
      <Text style={estilos.legenda}>{rotulo}</Text>
      <Text style={estilos.corpoForte}>{valor}</Text>
    </View>
  );
}

export default function TelaDetalheCarona() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [carregamento, setCarregamento] = useState<Carregamento>({ tipo: 'carregando' });
  const [reservando, setReservando] = useState(false);
  const [erroReserva, setErroReserva] = useState<ErroReserva | null>(null);
  // Trava síncrona contra duplo toque: o estado do React só muda no próximo render
  const reservaEmAndamento = useRef(false);

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
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }

  if (carregamento.tipo === 'erro') {
    return (
      <View style={estilos.centro}>
        <EstadoVazio
          icone="cloud-offline-outline"
          titulo="Não foi possível carregar"
          mensagem={carregamento.mensagem}
          acao={{ titulo: 'Voltar', onPress: () => router.back() }}
        />
      </View>
    );
  }

  const { carona } = carregamento;
  const exibirBarra = podeReservar(carona);
  const valor = formatarReais(carona.valorPorPassageiroCentavos);

  const reservar = async () => {
    if (reservaEmAndamento.current) {
      return;
    }
    reservaEmAndamento.current = true;
    setReservando(true);
    setErroReserva(null);
    try {
      const reserva = await reservarVaga(carona.id_carona);
      guardarPix(reserva);
      router.push({ pathname: '/reservas/[id]', params: { id: reserva.idReserva } });
    } catch (falha) {
      const erro = normalizarErro(falha);
      setErroReserva({ mensagem: erro.message, atalho: atalhoDoErroDeReserva(erro.code) });
    } finally {
      reservaEmAndamento.current = false;
      setReservando(false);
    }
  };

  // O valor mostrado é o que o backend calculou (valor_por_passageiro); a reservar_vaga cobra o
  // mesmo cálculo
  const confirmarReserva = () => {
    Alert.alert('Reservar vaga', `Reservar por ${valor}? O pagamento é por Pix.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reservar', onPress: () => void reservar() },
    ]);
  };

  return (
    <View style={estilos.tela}>
      <ScrollView
        contentContainerStyle={[
          estilos.conteudo,
          {
            paddingBottom: exibirBarra
              ? ALTURA_BARRA + insets.bottom + tema.espaco.x4
              : insets.bottom + tema.espaco.x6,
          },
        ]}
      >
        {carona.sou_motorista ? <Aviso tipo="info" mensagem="Esta é a sua carona." /> : null}
        {carona.status !== 'ABERTA' ? (
          <Aviso tipo="info" mensagem={`Situação: ${ROTULO_STATUS[carona.status]}.`} />
        ) : null}

        <View style={estilos.cartao}>
          <Text style={estilos.legenda}>{formatarDataLonga(carona.data_hora_partida)}</Text>
          <View style={estilos.linhaHora}>
            <Text style={estilos.hora} maxFontSizeMultiplier={1.4}>
              {formatarHora(carona.data_hora_partida)}
            </Text>
            <Text style={estilos.legenda}>Horário de Brasília</Text>
          </View>
          <View style={estilos.divisoria} />
          <LinhaRota origem={carona.origem} destino={carona.destino} variante="completa" />
        </View>

        <View style={estilos.blocoValor}>
          <Text style={estilos.rotuloValor}>Valor por passageiro</Text>
          <Text style={estilos.valor} maxFontSizeMultiplier={1.4}>
            {valor}
          </Text>
          <LinhaComIcone
            icone="calculator-outline"
            texto={`Custo total de ${formatarReais(carona.custoTotalCentavos)}, dividido entre motorista e passageiros.`}
          />
          <LinhaComIcone icone="qr-code-outline" texto="Pagamento por Pix, dentro do app." />
        </View>

        <View style={estilos.linhaCartoes}>
          <CartaoInfo
            icone="people-outline"
            rotulo="Vagas"
            valor={`${carona.vagas_disponiveis} de ${carona.vagas_ofertadas} disponíveis`}
          />
          <CartaoInfo
            icone="hourglass-outline"
            rotulo="Tolerância de espera"
            valor={`${carona.tolerancia_min} min`}
          />
        </View>
        {carona.somente_mulheres ? (
          <View style={estilos.somenteMulheres}>
            <SeloStatus tipo="SOMENTE_MULHERES" />
            <Text style={estilos.legenda}>Só passageiras podem reservar.</Text>
          </View>
        ) : null}

        <View style={estilos.cartao}>
          <View style={estilos.motorista}>
            <Avatar nome={carona.nome_motorista} tamanho={48} />
            <View style={estilos.textosMotorista}>
              <Text style={estilos.legenda}>Motorista</Text>
              <Text style={estilos.corpoForte}>{carona.nome_motorista}</Text>
              {/* Todo usuário com acesso confirmou o e-mail institucional (RN01) */}
              <View style={estilos.confirmado}>
                <Ionicons name="shield-checkmark" size={14} color={cores.sucesso} />
                <Text style={estilos.textoConfirmado}>E-mail institucional confirmado</Text>
              </View>
            </View>
          </View>
          <View style={estilos.divisoria} />
          <View style={estilos.veiculo}>
            <Ionicons name="car-outline" size={22} color={cores.textoSecundario} />
            <Text style={[estilos.corpo, estilos.flex]}>
              {descreverVeiculo(carona.modelo, carona.cor, ' · ')}
            </Text>
            <Placa placa={carona.placa} />
          </View>
        </View>
      </ScrollView>

      {exibirBarra ? (
        <View style={[estilos.barra, { paddingBottom: insets.bottom + tema.espaco.x3 }]}>
          {/* Erro da reserva logo acima do botão que a disparou */}
          {erroReserva ? (
            <Aviso
              mensagem={erroReserva.mensagem}
              acao={
                erroReserva.atalho === 'minhas_reservas'
                  ? { titulo: 'Ver minhas reservas', onPress: () => router.push('/reservas') }
                  : undefined
              }
            />
          ) : null}
          <View style={estilos.linhaBarra}>
            <View>
              <Text style={estilos.valorBarra}>{valor}</Text>
              <Text style={estilos.legenda}>por pessoa · Pix</Text>
            </View>
            <Botao
              titulo="Reservar vaga"
              carregando={reservando}
              onPress={confirmarReserva}
              estilo={estilos.flex}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: tema.espaco.x5, gap: tema.espaco.x4 },
  centro: {
    flex: 1,
    justifyContent: 'center',
    padding: tema.espaco.x5,
    backgroundColor: cores.fundo,
  },
  flex: { flex: 1 },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: tema.raio.grande,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: tema.espaco.x4,
    gap: tema.espaco.x3,
    ...tema.sombra.cartao,
  },
  cartaoInfo: { flex: 1, padding: 14, gap: tema.espaco.x1 },
  linhaCartoes: { flexDirection: 'row', gap: tema.espaco.x3 },
  linhaHora: { flexDirection: 'row', alignItems: 'baseline', gap: tema.espaco.x2 },
  hora: { ...tema.tipografia.display, ...tema.numerico, color: cores.texto },
  divisoria: { height: 1, backgroundColor: cores.borda },
  blocoValor: {
    backgroundColor: cores.primariaClara,
    borderRadius: tema.raio.grande,
    padding: tema.espaco.x4,
    gap: 10,
  },
  rotuloValor: { ...tema.tipografia.rotulo, color: cores.primaria },
  valor: { ...tema.tipografia.display, ...tema.numerico, color: cores.primaria },
  linhaComIcone: { flexDirection: 'row', alignItems: 'flex-start', gap: tema.espaco.x2 },
  apoio: { ...tema.tipografia.apoio, color: cores.texto, flex: 1 },
  somenteMulheres: { gap: tema.espaco.x1, marginTop: -tema.espaco.x1 },
  motorista: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x3 },
  textosMotorista: { flex: 1, gap: 2 },
  confirmado: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x1 },
  textoConfirmado: { ...tema.tipografia.legenda, fontWeight: '600', color: cores.sucesso },
  veiculo: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x3 },
  legenda: { ...tema.tipografia.legenda, color: cores.textoSecundario },
  corpo: { ...tema.tipografia.corpo, color: cores.texto },
  corpoForte: { ...tema.tipografia.corpoForte, color: cores.texto },
  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: tema.espaco.x3,
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    paddingTop: 14,
    paddingHorizontal: tema.espaco.x5,
    ...tema.sombra.flutuante,
  },
  linhaBarra: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x4 },
  valorBarra: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: cores.texto,
    ...tema.numerico,
  },
});
