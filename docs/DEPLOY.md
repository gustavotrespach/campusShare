# Deploy público — CampusShare (T33)

> Publicação do MVP para acesso por link público, sem segredos no repositório. Estado de 12/11/2026.

## Links

| O quê | Link |
|---|---|
| APK Android (permanente) | <https://github.com/gustavotrespach/campusShare/releases/download/v1.0.0/CampusShare-1.0.0.apk> |
| Página da release | <https://github.com/gustavotrespach/campusShare/releases/tag/v1.0.0> |
| iPhone (Expo Go, EAS Update do canal `preview`) | [QR do update](https://qr.expo.dev/eas-update?slug=exp&projectId=248fc581-4de3-436c-a33e-749b0be9f49b&groupId=6d573651-ecc2-460c-8686-4907d8518597) |
| Backend (Supabase, projeto **CampusShare**, região São Paulo) | <https://yqovnmlrbpkgwzmlnncb.supabase.co> — `GET /functions/v1/health` → `{"status":"ok"}` |
| Repositório | <https://github.com/gustavotrespach/campusShare> |

O link de artefato do EAS expira (o do APK de 18/10 deixou de funcionar em 01/11); por isso o APK fica anexado à release do GitHub.

## Onde cada parte roda

| Parte | Plataforma | Como é publicada |
|---|---|---|
| App Android | EAS Build (perfil `preview`, APK) + GitHub Releases | `npx eas-cli build -p android --profile preview` e upload na release |
| App iPhone | Expo Go + EAS Update (canal `preview`) | `npx eas-cli update --channel preview --environment preview` |
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
- [x] Link testado em aba anônima, fora da máquina de quem fez o deploy

## Observações

- O projeto Supabase foi pausado por inatividade depois da AP2 e reativado em 12/11; o workflow **Manter ativo** evita nova pausa. O GitHub desliga workflows agendados após 60 dias sem atividade no repositório: reative em Actions se isso acontecer.
- Para reativar à mão: painel do Supabase → projeto → **Restore project**, e depois Actions → Deploy → *Run workflow* se houver migration nova.
- Contas de teste: o cadastro só aceita e-mail `@rede.ulbra.br`; o envio pelo Resend em modo de teste só entrega ao dono da conta, então contas extras são criadas no painel (Add user → Auto Confirm).
