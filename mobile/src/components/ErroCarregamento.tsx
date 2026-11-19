import { EstadoVazio } from './EstadoVazio';

interface Props {
  mensagem: string;
  aoTentarDeNovo: () => void;
  // Saída da tela quando ela não serve sem os dados (ex.: Editar veículo)
  aoVoltar?: () => void;
}

// Erro de carregamento da tela (estados comuns, tela 14 do DESIGN.md)
export function ErroCarregamento({ mensagem, aoTentarDeNovo, aoVoltar }: Props) {
  return (
    <EstadoVazio
      icone="cloud-offline-outline"
      titulo="Não foi possível carregar"
      mensagem={mensagem}
      acao={{ titulo: 'Tentar de novo', onPress: aoTentarDeNovo }}
      acaoSecundaria={aoVoltar ? { titulo: 'Voltar', onPress: aoVoltar } : undefined}
    />
  );
}
