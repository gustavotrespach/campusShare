# Roteiro da demo — AP2 (22/10/2026)

Apresentação de 5 a 7 minutos do fluxo completo do CampusShare, rodando no **Supabase remoto**
(`yqovnmlrbpkgwzmlnncb`), sem depender do Mac do Gustavo nem do Wi-Fi da faculdade.

| Papel | Quem | Aparelho | Conta |
|---|---|---|---|
| Motorista | Gustavo | iPhone, app no **Expo Go** aberto pelo link/QR do EAS Update | e-mail institucional do Gustavo |
| Passageira | squad | Android com o **APK** (se houver aparelho) ou o mesmo iPhone, trocando de conta | `pedjoness28@rede.ulbra.br` |

Como instalar: README → "Como instalar a demo".

---

## 1. Preparação (véspera)

### Contas

- **Motorista (Gustavo):** conta já confirmada, com perfil completo.
- **Passageira:** `pedjoness28@rede.ulbra.br`, criada no painel do Supabase (Authentication →
  Users → Add user, com **Auto Confirm User**). Criada pelo painel, o nome dela vem da parte do
  e-mail antes do `@` e o gênero fica "não informado": entrar no app e ajustar nome e gênero no
  Perfil.
- **Cadastro ao vivo:** o SMTP usa o remetente de teste do Resend (`onboarding@resend.dev`), que
  **só entrega para o e-mail do dono da conta Resend** (o do Gustavo). Nenhum outro e-mail recebe o
  link. Duas opções:
  - **A (recomendada):** não cadastrar ao vivo. Mostrar a tela de cadastro e a recusa de um
    `@gmail.com` (a regra do domínio funciona sem enviar e-mail) e seguir com a conta já pronta.
  - **B (mais impactante, mais arriscada):** na véspera, **apagar a conta do Gustavo** no painel
    (Authentication → Users → Delete). Isso apaga em cascata o perfil, o veículo, as caronas dele
    e as reservas nessas caronas. Ao vivo, o Gustavo se cadastra, abre o e-mail no celular e
    confirma. Riscos: o e-mail pode demorar, e o limite é de **4 e-mails por hora** e **1 por
    minuto por endereço**; não fazer testes de cadastro nas horas antes da apresentação.
  - Se o link do e-mail não abrir o app, a conta **já está confirmada** (o Supabase confirma ao
    abrir o link): voltar ao app e tocar em **Entrar**.

### Dados

- Veículo do Gustavo cadastrado (se não for usar a opção B).
- **Carona de plano B** publicada na véspera pelo Gustavo, com partida no dia da apresentação mais
  tarde, origem perto de um dos pontos (ex.: Centro de Torres → ULBRA Torres, R$ 24,00, 3 vagas →
  **R$ 6,00 por passageiro**). Se publicar ao vivo falhar, a passageira reserva nesta.
- Conferir que a passageira **não tem reserva ativa** na carona que vai reservar ao vivo (senão
  aparece "Você já tem uma reserva nesta carona").

### Backend e pagamento

- `health` remota respondendo (Perfil → "Servidor: ok").
- Webhook do Mercado Pago apontando para
  `https://yqovnmlrbpkgwzmlnncb.supabase.co/functions/v1/webhook-mercado-pago`, com o segredo
  da aplicação do **vendedor de teste** no `MERCADO_PAGO_WEBHOOK_SECRET` (MEMORY → "Segredo do
  webhook no sandbox").
- Fazer **um ensaio completo** na véspera, até "Pagamento confirmado!", e anotar quanto o Pix
  demorou.

### Aparelhos e rede

- Bateria cheia nos dois aparelhos e carregador/power bank na sala.
- Internet própria: **4G/5G** nos celulares e um **hotspot** de reserva (não contar com o Wi-Fi
  da faculdade).
- iPhone: Expo Go atualizado (SDK 57), com o update aberto **pelo menos uma vez** antes da
  apresentação (pelo QR/link do README).
- Android: APK instalado e aberto uma vez.
- Brilho no máximo, "Não perturbe" ligado, tamanho de fonte normal.

### Contingência

- **Vídeo gravado** do fluxo completo (cadastro → confirmada), de 2 a 3 minutos, no notebook e no
  celular, pronto para tocar sem internet.
- Prints das telas principais no slide, caso o vídeo também falhe.

---

## 2. Fluxo da apresentação (5 a 7 min)

Abertura (30 s): "O CampusShare é a carona entre estudantes da mesma faculdade. Ele resolve dois
problemas: **segurança** (só entra quem tem e-mail institucional) e o **constrangimento de cobrar a
gasolina** (o app divide o valor e o pagamento é por Pix, dentro do app)."

| # | Passo | O que mostrar | O que falar |
|---|---|---|---|
| 1 | **Cadastro** (≈ 1 min) | Tela Entrar → Criar conta. Digitar um `@gmail.com` e mostrar a recusa. Opção B: cadastrar o Gustavo com o e-mail institucional e confirmar pelo link. | "**Diferencial 1:** só cria conta quem tem e-mail `@rede.ulbra.br`, e a conta só funciona depois de confirmar o e-mail. Quem está no app é colega de verdade." |
| 2 | **Veículo** (≈ 30 s) | Perfil → Meus veículos → Cadastrar veículo (modelo, placa, cor, lugares). | "O motorista cadastra o carro uma vez. A placa aparece para o passageiro reconhecer o carro no embarque." |
| 3 | **Publicar carona** (≈ 1 min) | Início → Oferecer carona: veículo, origem, destino, horário, vagas e custo total da gasolina (ex.: R$ 24,00, 3 vagas). Publicar. | "O motorista informa só o custo total. **Quem calcula o valor de cada um é o servidor**, não o celular: o motorista também entra na divisão." |
| 4 | **Buscar** (≈ 30 s) | Na conta da passageira: Início → chips "Perto de" → a carona aparece com hora, valor por pessoa, vagas e distância. | "A busca mostra as caronas perto do ponto escolhido, das mais perto para as mais longe." |
| 5 | **Reservar com rateio** (≈ 1 min) | Tocar na carona → bloco verde "Valor por passageiro **R$ 6,00**", "Custo total de R$ 24,00, dividido entre motorista e passageiros" → Reservar vaga → confirmar "Reservar por R$ 6,00?". | "**Diferencial 2:** ninguém precisa pedir dinheiro. R$ 24 dividido por 4 (3 passageiros + motorista) dá R$ 6. O valor é fixado na publicação e a vaga fica reservada na hora, sem risco de duas pessoas pegarem a última vaga." |
| 6 | **Pix sandbox** (≈ 30 s a 3,5 min) | Tela de pagamento: selo "Aguardando pagamento", QR do Pix e "Copiar código Pix". | "Aqui a passageira pagaria com o app do banco. **O Pix é de teste (sandbox do Mercado Pago) e aprova sozinho em segundos**; a tela se atualiza sozinha, sem recarregar." |
| 7 | **Confirmada** (≈ 30 s) | "Pagamento confirmado! Sua vaga está garantida." → Minhas reservas com o selo "Confirmada". | "Quem confirma é o próprio Mercado Pago: ele avisa o nosso servidor, que confere o pagamento antes de garantir a vaga. O celular não consegue marcar como pago." |

Fechamento (30 s): fala de arquitetura (seção 4) e próximos passos (avaliações, notificações,
cancelamento e expiração de reservas).

---

## 3. Plano B para cada falha

| Falha | O que fazer |
|---|---|
| **Sem internet** | Trocar para o 4G/hotspot. Se continuar sem rede, tocar o **vídeo gravado** e narrar os mesmos passos por cima dele. |
| **E-mail de confirmação demorando** (opção B) | Não esperar: dizer "o e-mail chega em instantes" e seguir com a conta da passageira já pronta. Voltar ao e-mail no fim, se ele tiver chegado. |
| **Link do e-mail não abre o app** | A conta já está confirmada: voltar ao app e Entrar com a senha. |
| **Publicar carona falha** | Usar a carona de plano B publicada na véspera. |
| **"Você já tem uma reserva nesta carona"** | Tocar em "Ver minhas reservas" e abrir a reserva existente; ou reservar na carona de plano B. |
| **Aprovação do Pix demorando** (pode levar até ~3,5 min no sandbox) | Deixar a tela de pagamento aberta e **usar a espera**: apresentar a arquitetura (seção 4) e explicar o webhook ("estamos esperando o Mercado Pago avisar o nosso servidor; quando ele avisar, a tela muda sozinha"). Se passar de ~4 min, abrir Minhas reservas e mostrar a reserva do ensaio da véspera já "Confirmada"; depois do limite de 15 min a tela mostra "Verificar de novo". |
| **App fecha ou trava** | Reabrir pelo Expo Go (Recents) ou pelo ícone do APK; a sessão continua salva. O QR do Pix não volta depois de reabrir (fica só em memória); a reserva aparece em Minhas reservas e confirma do mesmo jeito. |

---

## 4. Arquitetura em 1 minuto (slide + fala)

Slide: um desenho com quatro caixas, da esquerda para a direita: **App (Expo)** → **Supabase**
(banco + regras + funções) → **Mercado Pago**, e uma seta de volta, **webhook**, do Mercado Pago
para o Supabase.

Fala:

> "O app é feito em **React Native com Expo**: um código só para Android e iPhone. Todo o backend
> está no **Supabase**: login com confirmação de e-mail, banco PostgreSQL e as regras de negócio.
> As regras importantes, como o domínio do e-mail, o cálculo do valor de cada passageiro e o
> controle de vagas, rodam **no servidor**, dentro do banco. Assim ninguém consegue burlar
> mexendo no app.
>
> Para o pagamento, uma função do servidor (**Edge Function**) cria a cobrança Pix no **Mercado
> Pago**. Quando o Pix é pago, o Mercado Pago chama outra função nossa, o **webhook**. Ela confere a
> assinatura do aviso e consulta o pagamento direto no Mercado Pago antes de confirmar a vaga. O
> celular só mostra o resultado.
>
> Tudo isso usa planos gratuitos: custo zero."
