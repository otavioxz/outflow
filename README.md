# Outflow

> Controle de gastos pelo WhatsApp.

Controle de gastos mensais alimentado pelo WhatsApp. Você manda uma mensagem (texto ou áudio), a IA entende o gasto e ele aparece no dashboard.

```
WhatsApp ──webhook──► /api/webhook ──► áudio? transcreve ──► Claude extrai o gasto ──► SQLite
                                                                                         │
                                                       Dashboard (/) ◄──────────────────┘
```

## Rodando

```bash
npm install
cp .env.example .env     # já existe um .env com valores padrão
npm run dev              # http://localhost:3000
```

### Login

O painel é privado. Não existe cadastro pelo site: você dá acesso pelo terminal.

```bash
npm run usuario -- adicionar seu@email.com "Seu Nome"   # pede a senha (mín. 8 caracteres) sem mostrar na tela
npm run usuario -- listar                               # quem tem acesso
npm run usuario -- senha seu@email.com                  # troca a senha e encerra as sessões abertas
npm run usuario -- remover email@de.alguem.com          # tira o acesso
```

A sessão dura 30 dias. Depois de 5 senhas erradas seguidas, o login daquele e-mail fica bloqueado por 15 minutos.
Todos os usuários veem os mesmos gastos.

Em outro terminal, converse com o bot pelo **simulador** (ele manda o mesmo JSON que a Meta mandaria):

```bash
npm run simular                           # modo conversa
npm run simular -- "gastei 45 no ifood"   # uma mensagem só
npm run simular -- --audio teste.ogg      # áudio que esteja na pasta amostras/
```

### Comandos do bot
| Mensagem | O que faz |
|---|---|
| `gastei 45 no ifood`, `mercado 230 no débito e uber 18,50` | registra um ou mais gastos |
| `resumo` | total do mês por categoria |
| `desfazer` | apaga o último gasto |
| `ajuda` | lista os comandos |

## Configuração (`.env`)

Tudo é opcional para começar. O app se adapta ao que estiver preenchido:

| Variável | Sem ela | Com ela |
|---|---|---|
| `ANTHROPIC_API_KEY` | extrator simples por palavras-chave | o Claude entende frases livres, vários gastos por mensagem, "ontem", valores por extenso |
| `TRANSCRICAO_API_KEY` | áudios são recusados | áudios são transcritos (OpenAI Whisper ou Groq) |
| `WHATSAPP_TOKEN` | **modo simulação**: respostas voltam para o simulador | respostas são enviadas pelo WhatsApp |
| `APP_SECRET` | assinatura não é checada (só no modo simulação) | só aceita requisições assinadas pela Meta |
| `ORCAMENTO_MENSAL` | — | mostra % do orçamento no bot e no dashboard |

💡 Para economizar na IA, troque `CLAUDE_MODEL` para `claude-haiku-5-5`.

## Conectando o WhatsApp de verdade

1. Siga o passo a passo da Meta (criar app → WhatsApp → Configuração da API) e preencha `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `APP_SECRET` e `MEU_NUMERO`.
2. Exponha o servidor: `ngrok http 3000`.
3. No painel da Meta → WhatsApp → Configuração → Webhook:
   - URL de callback: `https://SEU-ENDERECO.ngrok-free.app/api/webhook`
   - Token de verificação: o valor de `VERIFY_TOKEN`
   - Assine o campo **messages**
4. Mande uma mensagem para o número de teste. 🎉

## Estrutura

```
src/
  app/
    page.tsx              dashboard
    actions.ts            apagar gasto
    login/                tela de login e ações de entrar/sair
    api/versao/route.ts   usado pela atualização em tempo real
  components/
    ui/                   componentes do shadcn/ui
    graficos.tsx          gráficos (Recharts)
    ao-vivo.tsx           atualiza o painel sozinho a cada 3 s
    menu-usuario.tsx      menu com nome e botão Sair
  proxy.ts                manda para o login quem não tem sessão
    api/webhook/route.ts  webhook do WhatsApp (GET = verificação, POST = mensagens)
  lib/
    bot.ts                lógica das conversas e comandos
    extrator.ts           texto → gastos (Claude, ou palavras-chave sem chave de API)
    transcricao.ts        áudio → texto
    whatsapp.ts           envio, download de mídia, assinatura
    gastos.ts             consultas no banco
    db.ts                 conexão SQLite/libSQL e criação das tabelas
    usuarios.ts           senhas (scrypt), sessões e cadastro de usuários
    auth.ts               usuário logado e limite de tentativas
scripts/simular.mts       simulador do WhatsApp
scripts/usuario.mts       gerencia quem pode entrar
```

## Deploy (depois)

- **Banco:** crie um banco gratuito no [Turso](https://turso.tech) e troque `DATABASE_URL`/`DATABASE_AUTH_TOKEN`. O código é o mesmo.
- **App:** Vercel, Railway ou Render. Configure as variáveis do `.env` no painel e use a URL pública no webhook da Meta.
- Em produção (HTTPS) o cookie de sessão já sai com a flag `secure`.
