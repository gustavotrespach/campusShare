import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Aviso } from '@/components/Aviso';
import { Botao } from '@/components/Botao';
import { CampoTexto } from '@/components/CampoTexto';
import { SeletorOpcoes, type Opcao } from '@/components/SeletorOpcoes';
import { normalizarErro } from '@/services/erros';
import { CODIGO_PLACA_DUPLICADA, type DadosVeiculo, type Veiculo } from '@/services/veiculos';
import { consumoSugerido, ehMotorizacao, formatarConsumo, MOTORIZACOES } from '@/utils/consumo';
import { temErros, validarVeiculo, type CamposVeiculo, type ErrosDeCampo } from '@/utils/validacao';

const LUGARES_PADRAO = 5;

const OPCOES_LUGARES: Opcao<number>[] = [2, 3, 4, 5, 6, 7, 8].map((lugares) => ({
  valor: lugares,
  rotulo: String(lugares),
}));

const OPCOES_MOTORIZACAO: Opcao<string | null>[] = [
  ...MOTORIZACOES.map((motorizacao) => ({ valor: motorizacao, rotulo: motorizacao })),
  { valor: null, rotulo: 'Outra/não sei' },
];

interface Props {
  inicial?: Veiculo;
  tituloBotao: string;
  // Lança AppError em caso de falha; o formulário mostra no campo certo ou no aviso
  aoSalvar: (dados: DadosVeiculo) => Promise<void>;
}

export function FormularioVeiculo({ inicial, tituloBotao, aoSalvar }: Props) {
  const [modelo, setModelo] = useState(inicial?.modelo ?? '');
  const [placa, setPlaca] = useState(inicial?.placa ?? '');
  const [cor, setCor] = useState(inicial?.cor ?? '');
  const [lugares, setLugares] = useState(inicial?.qtd_lugares ?? LUGARES_PADRAO);
  // Motorização fora da lista (não vem do app, mas pode existir no banco) aparece como "Outra"
  const [motorizacao, setMotorizacao] = useState<string | null>(
    ehMotorizacao(inicial?.motorizacao ?? null) ? (inicial?.motorizacao ?? null) : null,
  );
  const [consumo, setConsumo] = useState(formatarConsumo(inicial?.consumo_kml ?? null));
  const [errosCampo, setErrosCampo] = useState<ErrosDeCampo<CamposVeiculo>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Escolher a motorização sugere o consumo; o campo continua editável (o que vale é o confirmado)
  const aoMudarMotorizacao = (valor: string | null) => {
    setMotorizacao(valor);
    const sugerido = consumoSugerido(valor);
    if (sugerido !== null) {
      setConsumo(formatarConsumo(sugerido));
      setErrosCampo((anteriores) => ({ ...anteriores, consumo_kml: undefined }));
    }
  };

  const aoEnviar = async () => {
    const erros = validarVeiculo({ modelo, placa, cor, consumo_kml: consumo });
    setErrosCampo(erros);
    setErroGeral(null);
    if (temErros(erros)) {
      return;
    }
    setSalvando(true);
    try {
      await aoSalvar({
        modelo,
        placa,
        cor,
        qtd_lugares: lugares,
        motorizacao,
        consumo_kml: consumo,
      });
    } catch (falha) {
      const erro = normalizarErro(falha);
      if (erro.code === CODIGO_PLACA_DUPLICADA) {
        setErrosCampo({ placa: erro.message });
      } else {
        setErroGeral(erro.message);
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <View style={estilos.container}>
      <CampoTexto
        rotulo="Modelo"
        value={modelo}
        onChangeText={setModelo}
        erro={errosCampo.modelo}
        autoCapitalize="words"
        placeholder="Ex.: Chevrolet Onix"
      />
      <CampoTexto
        rotulo="Placa"
        value={placa}
        onChangeText={setPlaca}
        erro={errosCampo.placa}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        placeholder="ABC1D23"
      />
      <CampoTexto
        rotulo="Cor"
        value={cor}
        onChangeText={setCor}
        erro={errosCampo.cor}
        autoCapitalize="sentences"
        placeholder="Ex.: Prata"
      />
      <SeletorOpcoes
        rotulo="Lugares"
        ajuda="Contando com o motorista."
        opcoes={OPCOES_LUGARES}
        valor={lugares}
        aoMudar={setLugares}
      />
      <SeletorOpcoes
        rotulo="Motorização"
        ajuda="Sugere o consumo; você pode ajustar abaixo."
        opcoes={OPCOES_MOTORIZACAO}
        valor={motorizacao}
        aoMudar={aoMudarMotorizacao}
      />
      <CampoTexto
        rotulo="Consumo na cidade, km/l (opcional)"
        value={consumo}
        onChangeText={setConsumo}
        erro={errosCampo.consumo_kml}
        keyboardType="decimal-pad"
        placeholder="Ex.: 12,5"
      />

      {erroGeral ? <Aviso mensagem={erroGeral} /> : null}
      <Botao titulo={tituloBotao} carregando={salvando} onPress={aoEnviar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: 16 },
});
