import * as SecureStore from 'expo-secure-store';

// O SecureStore recusa (iOS) ou avisa (Android) valores acima de ~2048 bytes, e a sessão do
// Supabase passa disso. Em vez de AsyncStorage sem criptografia (docs/SECURITY.md), o valor é
// dividido em partes guardadas no próprio SecureStore: <chave>_partes guarda a quantidade.
// 500 code points × até 4 bytes em UTF-8 = no máximo 2000 bytes por parte; dividir por code
// point (e não por unidade UTF-16) evita cortar um caractere acentuado ou emoji ao meio.
export const CODE_POINTS_POR_PARTE = 500;

function chaveQuantidade(chave: string): string {
  return `${chave}_partes`;
}

function chaveParte(chave: string, indice: number): string {
  return `${chave}_parte_${indice}`;
}

function dividir(valor: string): string[] {
  const codePoints = Array.from(valor);
  const partes: string[] = [];
  for (let inicio = 0; inicio < codePoints.length; inicio += CODE_POINTS_POR_PARTE) {
    partes.push(codePoints.slice(inicio, inicio + CODE_POINTS_POR_PARTE).join(''));
  }
  return partes.length > 0 ? partes : [''];
}

async function lerQuantidade(chave: string): Promise<number> {
  const quantidade = Number(await SecureStore.getItemAsync(chaveQuantidade(chave)));
  return Number.isInteger(quantidade) && quantidade > 0 ? quantidade : 0;
}

async function apagarPartes(chave: string, de: number, ate: number): Promise<void> {
  for (let indice = de; indice < ate; indice += 1) {
    await SecureStore.deleteItemAsync(chaveParte(chave, indice));
  }
}

// Mesma interface de storage que o supabase-js espera (getItem/setItem/removeItem assíncronos).
export const armazenamentoSeguro = {
  async getItem(chave: string): Promise<string | null> {
    const quantidade = await lerQuantidade(chave);
    if (quantidade === 0) {
      return null;
    }
    const partes: string[] = [];
    for (let indice = 0; indice < quantidade; indice += 1) {
      const parte = await SecureStore.getItemAsync(chaveParte(chave, indice));
      if (parte === null) {
        // Gravação interrompida no meio: melhor pedir login de novo do que usar sessão corrompida.
        return null;
      }
      partes.push(parte);
    }
    return partes.join('');
  },

  async setItem(chave: string, valor: string): Promise<void> {
    const anterior = await lerQuantidade(chave);
    const partes = dividir(valor);
    for (const [indice, parte] of partes.entries()) {
      await SecureStore.setItemAsync(chaveParte(chave, indice), parte);
    }
    await SecureStore.setItemAsync(chaveQuantidade(chave), String(partes.length));
    await apagarPartes(chave, partes.length, anterior);
  },

  async removeItem(chave: string): Promise<void> {
    const anterior = await lerQuantidade(chave);
    await SecureStore.deleteItemAsync(chaveQuantidade(chave));
    await apagarPartes(chave, 0, anterior);
  },
};
