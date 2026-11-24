import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { obterPerfilPublico } from './avaliacoes';
import { AppError, normalizarErro } from './erros';
import { obterSupabase } from './supabase';

// Foto de perfil (T44): o único lugar do app que fala com o Storage. Bucket privado `fotos-perfil`,
// um arquivo por usuário em `<id>/avatar.jpg` (docs/API.md → "usuarios"). A regra de quem escreve
// onde é da RLS do Storage; a data da foto (e o ?v= do caminho) é do backend.
const BUCKET = 'fotos-perfil';
const LADO_PX = 512;
// O bucket recusa acima de 1 MB; a foto de 512 px costuma ficar bem abaixo disso
const LIMITE_BYTES = 1024 * 1024;
// Se a primeira passada ainda passar do limite, comprime mais
const QUALIDADES = [0.8, 0.6, 0.4] as const;

const SEM_SESSAO = new AppError(401, 'NAO_AUTENTICADO', 'Sua sessão expirou. Entre novamente.');

const FOTO_GRANDE = new AppError(
  413,
  'FOTO_GRANDE',
  'Essa foto ficou grande demais. Escolha outra imagem.',
);

const GALERIA_NEGADA = new AppError(
  403,
  'GALERIA_NEGADA',
  'Sem acesso às suas fotos. Permita o acesso às fotos do CampusShare nos Ajustes do celular.',
);

const FOTO_ILEGIVEL = new AppError(
  422,
  'FOTO_ILEGIVEL',
  'Não foi possível usar essa imagem. Escolha outra foto.',
);

export interface FonteFoto {
  uri: string;
  headers: Record<string, string>;
}

// Galeria com corte quadrado. Sem câmera nesta tarefa. Devolve null se o usuário cancelar.
// O seletor do sistema (iOS 14+ e Android 13+) não pede permissão antes; se o acesso estiver negado
// nos Ajustes, o erro vira uma frase que explica onde liberar.
export async function escolherFotoDaGaleria(): Promise<string | null> {
  try {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (resultado.canceled) {
      return null;
    }
    return resultado.assets[0]?.uri ?? null;
  } catch {
    throw GALERIA_NEGADA;
  }
}

async function idDaSessao(): Promise<string> {
  const { data } = await obterSupabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) {
    throw SEM_SESSAO;
  }
  return id;
}

function caminhoDoArquivo(idUsuario: string): string {
  return `${idUsuario}/avatar.jpg`;
}

// O React Native não envia Blob/File pelo storage-js: o arquivo vai como ArrayBuffer, montado a
// partir do base64 que o manipulador devolve (atob existe no Hermes), sem dependência extra.
function bytesDoBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

// 512×512 em JPEG; se passar de 1 MB, tenta de novo com qualidade menor
export async function prepararFoto(uri: string): Promise<Uint8Array<ArrayBuffer>> {
  let imagem;
  try {
    imagem = await ImageManipulator.manipulate(uri)
      .resize({ width: LADO_PX, height: LADO_PX })
      .renderAsync();
  } catch {
    throw FOTO_ILEGIVEL;
  }
  for (const qualidade of QUALIDADES) {
    const salva = await imagem.saveAsync({
      compress: qualidade,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (!salva.base64) {
      throw FOTO_ILEGIVEL;
    }
    const bytes = bytesDoBase64(salva.base64);
    if (bytes.byteLength <= LIMITE_BYTES) {
      return bytes;
    }
  }
  throw FOTO_GRANDE;
}

// Erros do Storage: 413 (acima do limite do bucket) vira FOTO_GRANDE; falha de rede, SEM_CONEXAO
function erroDoStorage(falha: unknown): AppError {
  if (typeof falha === 'object' && falha !== null && 'status' in falha && falha.status === 413) {
    return FOTO_GRANDE;
  }
  return normalizarErro(falha);
}

// Reduz, envia (upsert no caminho fixo) e confirma no backend, que grava a data da foto
export async function enviarFotoPerfil(uri: string): Promise<void> {
  const bytes = await prepararFoto(uri);
  const idUsuario = await idDaSessao();
  const supabase = obterSupabase();
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(caminhoDoArquivo(idUsuario), bytes.buffer, {
        upsert: true,
        contentType: 'image/jpeg',
      });
    if (error) {
      throw error;
    }
  } catch (falha) {
    throw erroDoStorage(falha);
  }
  try {
    const { error } = await supabase.rpc('definir_foto_perfil');
    if (error) {
      throw error;
    }
  } catch (falha) {
    throw normalizarErro(falha);
  }
}

// Apaga o arquivo pela API do Storage e depois tira a foto do perfil
export async function removerFotoPerfil(): Promise<void> {
  const idUsuario = await idDaSessao();
  const supabase = obterSupabase();
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([caminhoDoArquivo(idUsuario)]);
    if (error) {
      throw error;
    }
  } catch (falha) {
    throw erroDoStorage(falha);
  }
  try {
    const { error } = await supabase.rpc('remover_foto_perfil');
    if (error) {
      throw error;
    }
  } catch (falha) {
    throw normalizarErro(falha);
  }
}

// Fonte da <Image> para um `foto_caminho`/`foto_motorista` ("<id>/avatar.jpg?v=..."): o endpoint
// autenticado do Storage com o token da sessão atual e a chave publicável. Sem bucket público nem
// URL assinada. O ?v= vai na URL e muda a cada troca, então o cache da imagem não mostra a antiga.
export async function urlFotoPerfil(caminho: string): Promise<FonteFoto> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const chavePublicavel = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const { data } = await obterSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!url || !chavePublicavel || !token) {
    throw SEM_SESSAO;
  }
  return {
    uri: `${url}/storage/v1/object/authenticated/${BUCKET}/${caminho}`,
    headers: { Authorization: `Bearer ${token}`, apikey: chavePublicavel },
  };
}

// A própria foto (cabeçalho do Início), pelo mesmo perfil público que os outros veem
export async function obterMinhaFoto(): Promise<string | null> {
  const perfil = await obterPerfilPublico(await idDaSessao());
  return perfil.fotoCaminho;
}
