import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { reenviarConfirmacao } from '@/services/auth';
import { normalizarErro } from '@/services/erros';

// O Auth só aceita um novo envio por minuto (max_frequency = 1m no config.toml).
const SEGUNDOS_ENTRE_REENVIOS = 60;

type Retorno = { tipo: 'sucesso' | 'erro'; mensagem: string } | null;

export default function TelaConfiraEmail() {
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
    <View style={estilos.container}>
      <Text style={estilos.titulo}>Confira seu e-mail</Text>
      <Text style={estilos.texto}>
        Enviamos um link de confirmação para{' '}
        <Text style={estilos.destaque}>{email ?? 'o seu e-mail'}</Text>. Abra o link no celular para
        ativar sua conta. Se não encontrar, olhe também a caixa de spam.
      </Text>

      {retorno ? <Aviso mensagem={retorno.mensagem} tipo={retorno.tipo} /> : null}

      <Botao
        titulo={espera > 0 ? `Reenviar link (${espera}s)` : 'Reenviar link'}
        carregando={enviando}
        desabilitado={espera > 0 || !email}
        onPress={aoReenviar}
      />
      <Botao
        titulo="Voltar ao login"
        variante="secundario"
        onPress={() => router.replace('/entrar')}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, gap: 16, justifyContent: 'center' },
  titulo: { fontSize: 26, fontWeight: 'bold', color: '#1f2933' },
  texto: { fontSize: 16, lineHeight: 24, color: '#3e4c59' },
  destaque: { fontWeight: '600', color: '#1f2933' },
});
