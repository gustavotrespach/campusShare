import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { formatarDataHoraCompleta, FUSO_APP } from '@/utils/data-hora';
import { tema } from '@/tema';

import { Botao } from './Botao';

interface Props {
  rotulo: string;
  valor: Date;
  aoMudar: (data: Date) => void;
  erro?: string;
}

// O seletor mostra e interpreta o horário de Brasília (RNF06) mesmo com o aparelho em outro fuso;
// o valor é um instante (Date), enviado ao banco em UTC.
export function SeletorDataHora({ rotulo, valor, aoMudar, erro }: Props) {
  // Android não tem o modo "data e hora" num diálogo só: abre a data e depois a hora
  const abrirNoAndroid = (modo: 'date' | 'time') => {
    DateTimePickerAndroid.open({
      value: valor,
      mode: modo,
      is24Hour: true,
      timeZoneName: FUSO_APP,
      minimumDate: modo === 'date' ? new Date() : undefined,
      onValueChange: (_evento, data) => aoMudar(data),
    });
  };

  return (
    <View style={estilos.container}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.valor}>{formatarDataHoraCompleta(valor)} (horário de Brasília)</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={valor}
          mode="datetime"
          display="compact"
          locale="pt-BR"
          timeZoneName={FUSO_APP}
          minimumDate={new Date()}
          minuteInterval={5}
          onValueChange={(_evento, data) => aoMudar(data)}
          style={estilos.seletorIos}
        />
      ) : (
        <View style={estilos.botoes}>
          <Botao
            titulo="Mudar data"
            icone="calendar-outline"
            variante="secundario"
            onPress={() => abrirNoAndroid('date')}
            estilo={estilos.botao}
          />
          <Botao
            titulo="Mudar hora"
            icone="time-outline"
            variante="secundario"
            onPress={() => abrirNoAndroid('time')}
            estilo={estilos.botao}
          />
        </View>
      )}
      {erro ? (
        <Text accessibilityLiveRegion="polite" style={estilos.erro}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: tema.espaco.x2 },
  rotulo: { ...tema.tipografia.rotulo, color: tema.cores.texto },
  valor: { ...tema.tipografia.corpoForte, color: tema.cores.texto },
  seletorIos: { alignSelf: 'flex-start' },
  botoes: { flexDirection: 'row', gap: tema.espaco.x2 },
  // Lado a lado, cada um com metade da linha
  botao: { flex: 1, alignSelf: 'auto', paddingHorizontal: tema.espaco.x3 },
  erro: { ...tema.tipografia.legenda, color: tema.cores.erro },
});
