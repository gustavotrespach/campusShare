import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { IconeEmCirculo } from '@/components/IconeEmCirculo';
import { reenviarConfirmacao } from '@/services/auth';
import { normalizarErro } from '@/services/erros';
import { tema } from '@/tema';

// O Auth só aceita um novo envio por minuto (max_frequency = 1m no config.toml).
const SEGUNDOS_ENTRE_REENVIOS = 60;

type Retorno = { tipo: 'sucesso' | 'erro'; mensagem: string } | null;

export default function TelaConfiraEmail() {
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [espera, setEspera] = useState(SEGUNDOS_ENTRE_REENVIOS);
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState<Retorno>(null);

  useEffect(() => {
    if (espera <= 0) {
      return;
    }
    const temporizador = setTimeout(() => setEspera((anterior) => anterior - 1), 1000);
    return () => clearTimeout(temporizador);
  }, [espera]);

  const aoReenviar = async () => {
    if (!email) {
      return;
    }
    setEnviando(true);
    setRetorno(null);
    try {
      await reenviarConfirmacao(email);
      setRetorno({
        tipo: 'sucesso',
        mensagem: 'Enviamos um novo link. Confira sua caixa de entrada.',
      });
      setEspera(SEGUNDOS_ENTRE_REENVIOS);
    } catch (falha) {
      setRetorno({ tipo: 'erro', mensagem: normalizarErro(falha).message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={[
        estilos.conteudo,
        {
          paddingTop: insets.top + tema.espaco.x6,
          paddingBottom: insets.bottom + tema.espaco.x6,
        },
      ]}
    >
      <View style={estilos.topo}>
        <IconeEmCirculo icone="mail-unread-outline" />
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={estilos.titulo}>
          Confira seu e-mail
        </Text>
        <Text style={estilos.texto}>
          Enviamos um link de confirmação para{' '}
          <Text style={estilos.destaque}>{email ?? 'o seu e-mail'}</Text>. Abra o link no celular
          para ativar sua conta. Se não encontrar, olhe também a caixa de spam.
        </Text>
      </View>

      {retorno ? <Aviso mensagem={retorno.mensagem} tipo={retorno.tipo} /> : null}

      <Botao
        titulo={espera > 0 ? `Reenviar link (${espera}s)` : 'Reenviar link'}
        carregando={enviando}
        desabilitado={espera > 0 || !email}
        onPress={aoReenviar}
      />
      <Botao titulo="Voltar ao login" variante="texto" onPress={() => router.replace('/entrar')} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: tema.cores.fundo },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: tema.espaco.x5,
    gap: tema.espaco.x4,
  },
  topo: { alignItems: 'center', gap: tema.espaco.x3, marginBottom: tema.espaco.x2 },
  titulo: { ...tema.tipografia.titulo, color: tema.cores.texto, textAlign: 'center' },
  texto: { ...tema.tipografia.corpo, color: tema.cores.textoSecundario, textAlign: 'center' },
  destaque: { ...tema.tipografia.corpoForte, color: tema.cores.texto },
});
