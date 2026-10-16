import * as Linking from 'expo-linking';

// Para onde o link do e-mail de confirmação devolve o usuário: exp://<host>:8081/--/confirmacao no
// Expo Go e campusshare://confirmacao no app instalado. O Auth só aceita se o endereço estiver na
// allowlist (campusshare://**, exp://**) — e recusa host que é IP literal (ver MEMORY.md).
export function urlDeConfirmacao(): string {
  return Linking.createURL('/confirmacao');
}
