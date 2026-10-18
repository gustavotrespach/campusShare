import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { tema } from '@/tema';

import type { NomeIcone } from './icones';

interface Props extends TextInputProps {
  rotulo: string;
  erro?: string;
  ajuda?: string;
  icone?: NomeIcone;
  // Campo de senha com o botão de mostrar/ocultar
  senha?: boolean;
}

const { cores } = tema;

export function CampoTexto({
  rotulo,
  erro,
  ajuda,
  icone,
  senha = false,
  style,
  editable = true,
  secureTextEntry,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const [focado, setFocado] = useState(false);
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const somenteLeitura = editable === false;

  const borda = erro
    ? estilos.caixaErro
    : focado
      ? estilos.caixaFoco
      : somenteLeitura
        ? estilos.caixaLeitura
        : null;

  return (
    <View style={estilos.container}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <View style={[estilos.caixa, borda]}>
        {icone ? (
          <Ionicons
            name={icone}
            size={20}
            color={focado && !erro ? cores.primaria : cores.textoSecundario}
          />
        ) : null}
        <TextInput
          accessibilityLabel={rotulo}
          placeholderTextColor={cores.textoSutil}
          editable={editable}
          secureTextEntry={senha ? !senhaVisivel : secureTextEntry}
          onFocus={(evento) => {
            setFocado(true);
            onFocus?.(evento);
          }}
          onBlur={(evento) => {
            setFocado(false);
            onBlur?.(evento);
          }}
          style={[estilos.entrada, somenteLeitura ? estilos.entradaLeitura : null, style]}
          {...props}
        />
        {senha ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            onPress={() => setSenhaVisivel((atual) => !atual)}
            style={estilos.botaoSenha}
          >
            <Ionicons
              name={senhaVisivel ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={cores.textoSecundario}
            />
          </Pressable>
        ) : null}
      </View>
      {erro ? (
        <View style={estilos.linhaErro}>
          <Ionicons name="alert-circle" size={16} color={cores.erro} />
          <Text accessibilityLiveRegion="polite" style={estilos.erro}>
            {erro}
          </Text>
        </View>
      ) : ajuda ? (
        <Text style={estilos.ajuda}>{ajuda}</Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: 6 },
  rotulo: { ...tema.tipografia.rotulo, color: cores.texto },
  caixa: {
    minHeight: tema.toque.campo,
    borderRadius: tema.raio.medio,
    backgroundColor: cores.superficie,
    borderWidth: 1.5,
    borderColor: cores.bordaForte,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Borda 2 com padding 13.5: o texto não pula ao focar
  caixaFoco: { borderWidth: 2, borderColor: cores.primaria, paddingHorizontal: 13.5 },
  caixaErro: { borderWidth: 2, borderColor: cores.erro, paddingHorizontal: 13.5 },
  caixaLeitura: { backgroundColor: cores.neutroClaro, borderWidth: 1, borderColor: cores.borda },
  entrada: {
    flex: 1,
    ...tema.tipografia.corpo,
    color: cores.texto,
    paddingVertical: tema.espaco.x3,
  },
  entradaLeitura: { color: cores.textoSecundario },
  botaoSenha: {
    width: tema.toque.minimo,
    height: tema.toque.minimo,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  linhaErro: { flexDirection: 'row', alignItems: 'center', gap: tema.espaco.x1 },
  erro: { ...tema.tipografia.legenda, color: cores.erro, flex: 1 },
  ajuda: { ...tema.tipografia.legenda, color: cores.textoSecundario },
});
