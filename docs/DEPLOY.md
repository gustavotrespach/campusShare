# Deploy público — CampusShare (T33)

> Publicação do MVP para acesso por link público, sem segredos no repositório. Estado de 12/11/2026, atualizado com a versão 1.1.0 (SDK 58, T34).

## Links

| O quê | Link |
|---|---|
| APK Android atual — v1.1.0, SDK 58 (permanente) | <https://github.com/gustavotrespach/campusShare/releases/download/v1.1.0/CampusShare-1.1.0.apk> |
| Página da release v1.1.0 | <https://github.com/gustavotrespach/campusShare/releases/tag/v1.1.0> |
| APK v1.0.0, SDK 57 — versão entregue na TD de deploy (continua disponível) | <https://github.com/gustavotrespach/campusShare/releases/download/v1.0.0/CampusShare-1.0.0.apk> |
| Página da release v1.0.0 | <https://github.com/gustavotrespach/campusShare/releases/tag/v1.0.0> |
| App iPhone (Expo Go SDK 58) | `exp://u.expo.dev/248fc581-4de3-436c-a33e-749b0be9f49b/group/5037009b-8cd2-46bd-ac9a-68c8f88ea4c9` — [QR](https://qr.expo.dev/eas-update?slug=exp&projectId=248fc581-4de3-436c-a33e-749b0be9f49b&groupId=5037009b-8cd2-46bd-ac9a-68c8f88ea4c9) · [página do update](https://expo.dev/accounts/trespaco/projects/campusshare/updates/5037009b-8cd2-46bd-ac9a-68c8f88ea4c9) |
| Backend (Supabase, projeto **CampusShare**, região São Paulo) | <https://yqovnmlrbpkgwzmlnncb.supabase.co> — `GET /functions/v1/health` → `{"status":"ok"}` |
| Repositório | <https://github.com/gustavotrespach/campusShare> |

O link de artefato do EAS expira (o do APK de 18/10 deixou de funcionar em 01/11); por isso o APK fica anexado à release do GitHub.

## Onde cada parte roda

| Parte | Plataforma | Como é publicada |
|---|---|---|
| App Android | EAS Build (perfil `preview`, APK) + GitHub Releases | `npx eas-cli build -p android --profile preview` e upload na release |
| App iPhone | Expo Go + EAS Update (canal `preview`) | `npx eas-cli update --channel preview --environment preview`; SDK 58 desde a versão 1.1.0 (T34) |
| Banco, Auth, RLS e funções SQL | Supabase (free) | workflow **Deploy** a cada merge na `main` (`db push`) |
| Edge Functions | Supabase Edge Functions | workflow **Deploy** (`functions deploy`) |
| Projeto ativo | GitHub Actions | workflow **Manter ativo** a cada 3 dias (o free pausa após ~7 dias sem uso) |

## Variáveis e segredos

| Onde | Nomes | Observação |
|---|---|---|
| EAS, ambiente `preview` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Públicas por natureza (vão no app); o acesso é limitado pela RLS |
| Supabase secrets (Edge Functions) | `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` | `SUPABASE_*` são injetadas pelo próprio Supabase |
| GitHub Actions secrets | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` | Usadas pelo Deploy e pelo Manter ativo |
| Supabase Auth (SMTP) | chave do Resend | Enviada por `supabase config push`, fora do GitHub |

No repositório só existem os modelos `mobile/.env.example` e `supabase/functions/.env.example`, sem valores. A `service_role` não aparece no app.

## Checklist de publicação (12/11/2026)

- [x] Build de produção sem erros (EAS Build Android, perfil `preview`)
- [x] Variáveis de ambiente cadastradas na plataforma (EAS `preview`, Supabase secrets, GitHub secrets)
- [x] Nenhum segredo no repositório: histórico completo varrido (`.env` reais nunca commitados; nenhum padrão de chave do Mercado Pago, Resend, `service_role`/`sb_secret_`, GitHub ou Google)
- [x] HTTPS ativo (Supabase, GitHub Releases e expo.dev só respondem em HTTPS)
- [x] Link testado em aba anônima, fora da máquina de quem fez o deploy (Android de outra pessoa: APK baixado, instalado e login no Supabase de produção)

## Atualização 1.1.0 (T34, 12/11/2026)

- [x] App migrado para o Expo SDK 58 (`expo-doctor` 20/20, lint, typecheck e testes verdes) e testado no iPhone pelo Expo Go SDK 58
- [x] EAS Update publicado com runtime 1.1.0; runtime 1.0.0 conferido com o update antigo
- [x] APK 1.1.0 (versionCode 2, mesma keystore) anexado à release `v1.1.0`; release `v1.0.0` intacta
- [x] Os dois links de APK respondem 200

## Observações

- **iPhone:** o Expo Go só existe na versão mais recente e abre um único SDK. De 12/11 até a T34 o app (SDK 57) ficou indisponível no iPhone; desde a versão 1.1.0 (SDK 58) abre de novo pelo link acima.
- **Versões e runtime:** o `runtimeVersion` segue a `version` do app (policy `appVersion`). O APK v1.0.0 (runtime 1.0.0) só recebe updates de runtime 1.0.0 e continua com o update de 18/10 (SDK 57); o APK v1.1.0 e o Expo Go recebem os de runtime 1.1.0. Ao trocar de SDK, suba a `version` antes de publicar.
- O projeto Supabase foi pausado por inatividade depois da AP2 e reativado em 12/11; o workflow **Manter ativo** evita nova pausa. O GitHub desliga workflows agendados após 60 dias sem atividade no repositório: reative em Actions se isso acontecer.
- Para reativar à mão: painel do Supabase → projeto → **Restore project**, e depois Actions → Deploy → *Run workflow* se houver migration nova.
- Contas de teste: o cadastro só aceita e-mail `@rede.ulbra.br`; o envio pelo Resend em modo de teste só entrega ao dono da conta, então contas extras são criadas no painel (Add user → Auto Confirm).
