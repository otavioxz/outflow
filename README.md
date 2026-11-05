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

### Contas e login

Cada usuário tem os próprios gastos, guardados, orçamento e meta: ninguém vê os dados de outro.

- **Pelo site:** em `/cadastro`, com o código de convite (`CODIGO_CONVITE`). Sem essa variável, o cadastro fica fechado.
- **Pelo terminal:**

```bash
npm run usuario -- adicionar seu@email.com "Seu Nome"   # pede a senha (mín. 12 caracteres) sem mostrar na tela
npm run usuario -- listar                               # quem tem acesso
npm run usuario -- senha seu@email.com                  # troca a senha e encerra as sessões abertas
npm run usuario -- remover email@de.alguem.com          # tira o acesso
```

A sessão dura 30 dias. Depois de 5 senhas erradas seguidas, o login fica bloqueado por 15 minutos (veja "Publicando online com segurança").

### Ligando o WhatsApp à conta

O bot descobre de quem é cada mensagem pelo número de quem mandou. Para ligar um número a uma conta:

1. No site, **Configurações → WhatsApp → Gerar código**.
2. Mande `vincular 123456` (o código mostrado) para o bot, do WhatsApp que você quer usar. No celular, o botão
   **Abrir no WhatsApp** já deixa a mensagem escrita.
3. A tela se atualiza sozinha. Mensagens de números não vinculados são ignoradas (e aparecem no log do Discord).

O código vale 30 minutos e é de uso único. 5 códigos errados de um mesmo número bloqueiam novas tentativas por 15 minutos.
Esse caminho só depende de **receber** mensagens, então funciona mesmo quando a Meta não deixa o bot responder.

Em outro terminal, converse com o bot pelo **simulador** (ele manda o mesmo JSON que a Meta mandaria, do número em `MEU_NUMERO`):

```bash
npm run simular                           # modo conversa
npm run simular -- "gastei 45 no ifood"   # uma mensagem só
npm run simular -- "vincular 123456"      # liga o número do simulador à sua conta
npm run simular -- --audio teste.ogg      # áudio que esteja na pasta amostras/
npm run simular -- --foto nota.jpg        # foto de nota fiscal que esteja na pasta amostras/
```

### Comandos do bot
| Mensagem | O que faz |
|---|---|
| `gastei 45 no ifood`, `mercado 230 no débito e uber 18,50` | registra um ou mais gastos |
| `guardei 500 na poupança` | registra dinheiro guardado (fora dos gastos e do orçamento) |
| foto da nota fiscal | registra o total da nota como um gasto |
| `resumo` | total do mês por categoria e quanto foi guardado |
| `desfazer` | apaga o último lançamento |
| `vincular 123456` | liga este WhatsApp à conta que gerou o código |
| `ajuda` | lista os comandos |

### Testes

```bash
npm test          # testes automáticos (cada arquivo usa um banco SQLite temporário, sem chamar APIs)
npm run typecheck
```

Os testes cobrem o isolamento entre usuários, o vínculo do WhatsApp, a migração de bancos antigos, o extrator e as
validações. No GitHub, o workflow `.github/workflows/ci.yml` roda tipos, testes e build a cada push e pull request.

## Configuração (`.env`)

Tudo é opcional para começar. O app se adapta ao que estiver preenchido:

| Variável | Sem ela | Com ela |
|---|---|---|
| `ANTHROPIC_API_KEY` | extrator simples por palavras-chave | o Claude entende frases livres, vários gastos por mensagem, "ontem", valores por extenso |
| `TRANSCRICAO_API_KEY` | áudios são recusados | áudios são transcritos (OpenAI Whisper ou Groq) |
| `WHATSAPP_TOKEN` | **modo simulação**: respostas voltam para o simulador | respostas são enviadas pelo WhatsApp |
| `APP_SECRET` | assinatura não é checada (só no modo simulação) | só aceita requisições assinadas pela Meta |
| `CODIGO_CONVITE` | cadastro pelo site fechado | quem tem o código cria a própria conta em `/cadastro` |
| `MEU_NUMERO` | — | número usado pelo simulador; na migração de um banco antigo, vira o WhatsApp do primeiro usuário |

💡 Para economizar na IA, troque `CLAUDE_MODEL` para `claude-haiku-5-5`.

## Conectando o WhatsApp de verdade

1. Siga o passo a passo da Meta (criar app → WhatsApp → Configuração da API) e preencha `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID` e `APP_SECRET`.
2. Exponha o servidor: `ngrok http 3000`.
3. No painel da Meta → WhatsApp → Configuração → Webhook:
   - URL de callback: `https://SEU-ENDERECO.ngrok-free.app/api/webhook`
   - Token de verificação: o valor de `VERIFY_TOKEN`
   - Assine o campo **messages**
4. Ligue seu número à sua conta (veja "Ligando o WhatsApp à conta") e mande uma mensagem. 🎉

## Estrutura

```
src/
  app/
    page.tsx              dashboard
    actions.ts            apagar gasto / valor guardado
    login/                tela de login e ações de entrar/sair
    cadastro/             criar conta com código de convite
    configuracoes/        orçamento, meta, WhatsApp, senha e sessões
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
    gastos.ts             consultas de gastos (sempre filtradas pelo usuário)
    guardados.ts          dinheiro guardado no mês
    configuracoes.ts      orçamento e meta de cada usuário
    vinculo.ts            código "vincular 123456" que liga o WhatsApp à conta
    telefone.ts           formato dos números (com e sem o 9º dígito)
    db.ts                 conexão SQLite/libSQL, criação das tabelas e migrações
    usuarios.ts           senhas (scrypt), sessões e cadastro de usuários
    auth.ts               usuário logado
    limite-tentativas.ts  bloqueio por excesso de erros (login, convite, vínculo)
scripts/simular.mts       simulador do WhatsApp
scripts/usuario.mts       gerencia contas pelo terminal
tests/                    testes automáticos (npm test)
```

## Publicando online com segurança

### Publicando na Vercel
1. **Banco (Turso):** crie uma conta em [turso.tech](https://turso.tech), crie um banco (de preferência na região mais próxima de São Paulo) e gere um token. Crie o arquivo `.env.producao` (fica fora do git):
   ```env
   DATABASE_URL=libsql://seu-banco.turso.io
   DATABASE_AUTH_TOKEN=token-do-turso
   ```
2. **Levar os dados do seu computador:** `npm run migrar` (copia usuários e gastos do `financas.db` para o Turso).
3. **Vercel:** importe o repositório do GitHub em [vercel.com/new](https://vercel.com/new). Em *Environment Variables*, cole o conteúdo do `.env`
   e troque `DATABASE_URL`/`DATABASE_AUTH_TOKEN` pelos do Turso. A região já vem fixada em São Paulo (`vercel.json`).
4. **Meta:** troque a URL de callback do webhook para `https://seu-dominio/api/webhook` e os links de privacidade para
   `/privacidade` e `/exclusao-de-dados` no domínio novo.
5. **Usuários do site online:** use `--prod`, ex.: `npm run usuario -- listar --prod`.

Ao subir, se faltar alguma configuração essencial, chega no Discord **"Servidor iniciado com configuração insegura"** dizendo o que corrigir.

### O que já vem protegido
| Proteção | Como |
|---|---|
| Painel privado | Tudo exige login, exceto login, cadastro e o webhook. Cadastro só com código de convite (erros contam no limite de tentativas do IP). |
| Dados separados | Toda consulta filtra pelo usuário logado (ou dono do WhatsApp); apagar um id de outra conta não faz nada. Coberto pelos testes. |
| Senhas | Hash scrypt com sal; mínimo de 12 caracteres no cadastro. |
| Sessão | Cookie `__Host-sessao`: httpOnly (JavaScript não lê), secure (só HTTPS), SameSite=Lax, 30 dias. No banco fica só o hash do token. |
| Força bruta | 5 senhas erradas por conta+IP bloqueiam por 15 min; 15 erros de um IP bloqueiam o IP por 30 min. Fica no banco, então vale mesmo após reiniciar. |
| Webhook do WhatsApp | Assinatura HMAC da Meta obrigatória em produção; só aceita números vinculados a uma conta (ou o comando `vincular`); limite de tamanho; modo simulação desligado em produção. |
| Cabeçalhos HTTP | CSP restritiva, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; sem `X-Powered-By`. |
| Buscadores | `robots.txt` e `X-Robots-Tag: noindex`. |
| Formulários | Server Actions do Next só aceitam requisições do próprio site (proteção contra CSRF). |

### Logs de acesso (Discord)
Vão para o canal do `DISCORD_WEBHOOK_URL` (e sempre para o console do servidor):
login realizado, falha de login, bloqueio por tentativas, logout, gasto apagado pelo painel,
usuário adicionado/removido/senha trocada, webhook com assinatura falsa, mensagem de número não autorizado,
erros no servidor e o aviso de inicialização.

Além disso, **cada página aberta** gera um log completo do acesso (como no projeto fsite): página, quem está logado
(ou "não logado"), IP, localização aproximada e link para o mapa (na Vercel), fuso, idiomas, plataforma, tela,
janela, núcleos de CPU, memória, conexão, toque, tema e user-agent. Robôs/scripts são identificados no título.
A mesma página aberta pelo mesmo IP gera no máximo 1 log por minuto (a atualização ao vivo não gera logs). Eventos repetidos do mesmo IP são agrupados (1 por minuto)
e textos digitados por terceiros nunca geram menções (@everyone).
