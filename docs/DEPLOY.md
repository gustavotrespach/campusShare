# Deploy público — CampusShare (T33)

> Publicação do MVP para acesso por link público, sem segredos no repositório. Estado de 12/11/2026, atualizado com a versão 1.1.0 (SDK 58, T34), com as correções pós-deploy (T35, 17/11), com a navegação após "Sair" (T37, 17/11), com a migração do backend para o projeto Supabase novo (T36, 18/11), com a identidade visual das telas restantes e a busca de local (T39 e T40, 19/11), com a expiração de reservas (T24, 23/11) e com os cancelamentos e as listas legíveis (T28 e T41, 24/11).

## Links

| O quê | Link |
|---|---|
| APK Android atual — v1.1.0, SDK 58 (permanente) | <https://github.com/gustavotrespach/campusShare/releases/download/v1.1.0/CampusShare-1.1.0.apk> |
| Página da release v1.1.0 | <https://github.com/gustavotrespach/campusShare/releases/tag/v1.1.0> |
| APK v1.0.0, SDK 57 — versão entregue na TD de deploy (aponta para o backend antigo, inativo desde a T36) | <https://github.com/gustavotrespach/campusShare/releases/download/v1.0.0/CampusShare-1.0.0.apk> |
| Página da release v1.0.0 | <https://github.com/gustavotrespach/campusShare/releases/tag/v1.0.0> |
| App iPhone (Expo Go SDK 58) | `exp://u.expo.dev/248fc581-4de3-436c-a33e-749b0be9f49b/group/57d1e8e7-f9a2-4173-bc48-1f9523c95275` — [QR](https://qr.expo.dev/eas-update?slug=exp&projectId=248fc581-4de3-436c-a33e-749b0be9f49b&groupId=57d1e8e7-f9a2-4173-bc48-1f9523c95275) · [página do update](https://expo.dev/accounts/trespaco/projects/campusshare/updates/57d1e8e7-f9a2-4173-bc48-1f9523c95275) |
| Backend (Supabase, projeto `cofhvybajjzczrbojttv`, região São Paulo, desde a T36) | <https://cofhvybajjzczrbojttv.supabase.co> — `GET /functions/v1/health` → `{"status":"ok"}` |
| Webhook do Mercado Pago (aba Teste da aplicação CampusShare e aplicação do vendedor de teste; ver Observações) | `https://cofhvybajjzczrbojttv.supabase.co/functions/v1/webhook-mercado-pago` |
| Repositório | <https://github.com/gustavotrespach/campusShare> |

**A versão atual é a v1.1.0.** O APK v1.0.0 continua baixável, mas o update dele (runtime 1.0.0, de 18/10) aponta para o projeto Supabase antigo (`yqovnmlrbpkgwzmlnncb`), que ficou sem uso desde a migração da T36 e pausa sozinho: o login nele deixa de funcionar.

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

## Correções pós-deploy (T35, 17/11/2026)

- [x] `exps://**` na allowlist de redirect do Auth remoto (`supabase config push` do Gustavo; o Auth foi aplicado, e a etapa de Storage terminou com 402, sem alterar nada: ver Observações)
- [x] EAS Update da `main` com runtime 1.1.0 (grupo `9733805e-ebe6-41ff-bb63-dbf9f4f67ee0`, logout sem internet); runtime 1.0.0 conferido com o update de 18/10
- [x] Testado no iPhone (Expo Go SDK 58): "Sair" apaga a sessão com e sem internet (ao reabrir, abre no login)
- [x] Bug: depois do "Sair" aparecia a tela "Unmatched Route — Page could not be found" em vez do login (corrigido na T37, abaixo)

## Navegação após "Sair" (T37, 17/11/2026)

- [x] Causa: sem sessão, o guard do Expo Router 58 mandava para `"/(publico)"`, grupo sem `index`; corrigido com `redirectTo` nos `Stack.Protected` do `app/_layout.tsx`, com teste automatizado
- [x] EAS Update da `main` com runtime 1.1.0 (grupo `b9a904a8-3a58-453d-8ebb-f03b6fffb650`); runtime 1.0.0 conferido com o update de 18/10
- [x] Testado no iPhone pelo link público (Expo Go SDK 58, sem o Mac): "Sair" com Wi-Fi, "Sair" em modo avião e reabrir deslogado levam ao login

## Migração do backend (T36, 18/11/2026)

- [x] Projeto novo `cofhvybajjzczrbojttv` com as 12 migrations e as 3 Edge Functions pelo workflow **Deploy** (release #56); sem login, `health` responde 200, `reservar-vaga` 401 e `webhook-mercado-pago` 401 (`ASSINATURA_INVALIDA`)
- [x] Auth (hook de domínio, SMTP do Resend, `exps://**`) aplicado por `config push` do Gustavo, com `config diff` zerado; segredos do Mercado Pago cadastrados; webhook apontando para o projeto novo (notificação assinada: 200 com a assinatura certa, 401 com a errada)
- [x] Variáveis do EAS `preview` com a URL e a chave publicável novas; EAS Update da `main` (`7664eac`) com runtime 1.1.0, grupo `9a0e79e7-753c-4bba-93db-7df6bdeba244`, com só a URL nova no bundle (iOS e Android); runtime 1.0.0 conferido com o update de 18/10
- [x] Testado pelo Gustavo no iPhone pelo link público: login com a segunda conta, cadastro de veículo, publicação de carona, "Sair", login com a conta dele, reserva, Pix e confirmação automática pelo webhook em menos de 2 minutos
- [x] APK 1.1.0 (versionCode 3) gerado com o backend novo, substituído na release v1.1.0 com o mesmo link (T38, 19/11)
- [ ] Teste do APK 1.1.0 (versionCode 3) num Android real: login e "Caronas próximas" na primeira abertura

## Identidade visual e busca de local (T39 e T40, 19/11/2026)

- [x] T39 (identidade visual nas telas 2, 3, 4, 7, 10, 11, 12 e 13) e T40 (barra de busca de local na tela inicial) conferidas pelo Gustavo no iPhone pelo `npx expo start`
- [x] Release `develop` → `main` (#61) com o workflow **Deploy** verde: nenhuma migration nova ("Remote database is up to date"), Edge Functions sem mudança, `health` 200
- [x] EAS Update da `main` (`2184a13`) com runtime 1.1.0, grupo `21b7442c-8b4d-486e-9c33-fa9442a3d38f`; bundles de iOS e Android com a URL do projeto `cofhvybajjzczrbojttv` e sem a do antigo (conferidos pelo hash do manifesto publicado); runtime 1.0.0 conferido com o update de 18/10

## Cancelamentos e listas legíveis (T28 e T41, 24/11/2026)

- [x] T28 (cancelar reserva e carona, tela "Minhas caronas") conferida pelo Gustavo no iPhone contra o remoto (testes 1 a 6) e pagamentos conferidos no painel do Mercado Pago; T41 (seções "Próximas"/"Anteriores", card "Para …", selo "Já partiu") conferida no iPhone
- [x] Releases #68 (T28, com a migration `20261123225328_cancelamentos` aplicada pelo Deploy) e #70 (T41, sem migration); RPCs `cancelar_reserva` e `cancelar_carona` existem no remoto (401 `42501` sem sessão); `health` 200
- [x] Um único EAS Update da `main` (`2bc2040`) com runtime 1.1.0, grupo `57d1e8e7-f9a2-4173-bc48-1f9523c95275`; bundles de iOS e Android iguais aos publicados (hash do manifesto), com a URL do projeto `cofhvybajjzczrbojttv` e sem a do antigo; runtime 1.0.0 conferido com o update de 18/10

## Observações

- **iPhone:** o Expo Go só existe na versão mais recente e abre um único SDK. De 12/11 até a T34 o app (SDK 57) ficou indisponível no iPhone; desde a versão 1.1.0 (SDK 58) abre de novo pelo link acima.
- **Versões e runtime:** o `runtimeVersion` segue a `version` do app (policy `appVersion`). O APK v1.0.0 (runtime 1.0.0) só recebe updates de runtime 1.0.0 e continua com o update de 18/10 (SDK 57); o APK v1.1.0 e o Expo Go recebem os de runtime 1.1.0. Ao trocar de SDK, suba a `version` antes de publicar.
- **Migração (T36):** o projeto antigo (`yqovnmlrbpkgwzmlnncb`) ficou numa conta cujo painel não se acessa; o backend passou para o `cofhvybajjzczrbojttv`, na conta do Gustavo com login pelo GitHub. O projeto antigo não foi apagado nem alterado. Migração concluída em 18/11 (checklist acima). O primeiro APK v1.1.0 (versionCode 2, de 12/11) tinha a URL antiga embutida e só passava para a nova depois de baixar o EAS Update (o login falhava na primeira abertura); desde 19/11 a release `v1.1.0` tem, no mesmo link, o APK com versionCode 3 gerado com o backend novo (T38). Quem já instalou o anterior recebe o backend novo pelo EAS Update ou pode instalar o novo por cima (mesma keystore, versionCode maior).
- **Webhook do Mercado Pago no sandbox:** as orders de teste (`ORDTST…`) são notificadas pela URL da aba **Teste** em "Configuração de webhooks" da aplicação CampusShare. A aplicação do vendedor de teste só tem modo produção, com a URL dela. Ao trocar de backend, atualize **as duas URLs** e **não gere segredo novo**: o `MERCADO_PAGO_WEBHOOK_SECRET` cadastrado continua valendo, e um segredo novo obrigaria a refazer o `supabase secrets set`.
- O projeto Supabase antigo foi pausado por inatividade depois da AP2 e reativado em 12/11; o workflow **Manter ativo** evita nova pausa. O GitHub desliga workflows agendados após 60 dias sem atividade no repositório: reative em Actions se isso acontecer.
- **`supabase config push` e o erro 402:** Analytics Buckets (Iceberg) e Vector Buckets são do plano Pro, e qualquer escrita de Storage no plano gratuito pode voltar `402 entitlement_required` (`storage.iceberg_catalog`). Desde a T36 o `[remotes.producao]` declara os dois desligados. Se o push ainda mostrar uma mudança de Storage, responda **"n"** a ela: a CLI 2.119 pula só o Storage e termina com sucesso (código 0), e o Auth, que vem antes, já foi aplicado. O `storage.enabled` não evita a escrita: na 2.119 ele só controla o Storage local.
- **Expiração de reservas (T24):** o job `expirar-reservas` do pg_cron roda a cada minuto no projeto remoto (painel → Integrations → Cron) e o histórico em `cron.job_run_details` cresce ~1.440 linhas por dia até existir a limpeza (tarefa futura).
- Para reativar à mão: painel do Supabase → projeto → **Restore project**, e depois Actions → Deploy → *Run workflow* se houver migration nova.
- Contas de teste: o cadastro só aceita e-mail `@rede.ulbra.br`; o envio pelo Resend em modo de teste só entrega ao dono da conta, então contas extras são criadas no painel (Add user → Auto Confirm).
