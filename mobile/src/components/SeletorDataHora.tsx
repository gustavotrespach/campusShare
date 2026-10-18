import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatarDataHoraCompleta, FUSO_APP } from '@/utils/data-hora';
import { tema } from '@/tema';

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
          <Pressable
            accessibilityRole="button"
            onPress={() => abrirNoAndroid('date')}
            style={estilos.botao}
          >
            <Text style={estilos.textoBotao}>Mudar data</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => abrirNoAndroid('time')}
            style={estilos.botao}
          >
            <Text style={estilos.textoBotao}>Mudar hora</Text>
          </Pressable>
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
  container: { gap: 6 },
  rotulo: { fontSize: 14, fontWeight: '600', color: tema.cores.texto },
  valor: { fontSize: 15, color: tema.cores.texto },
  seletorIos: { alignSelf: 'flex-start' },
  botoes: { flexDirection: 'row', gap: 8 },
  botao: {
    borderWidth: 1,
    borderColor: tema.cores.primaria,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textoBotao: { fontSize: 15, color: tema.cores.primaria, fontWeight: '600' },
  erro: { fontSize: 13, color: tema.cores.erro },
});
