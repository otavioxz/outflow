import type { Metadata } from "next";
import Link from "next/link";
import { LogoCompleta } from "@/components/marca";

export const metadata: Metadata = { title: "Política de Privacidade · Outflow" };

const ATUALIZADA_EM = "31 de outubro de 2026";

// Página pública (exigida pela Meta para publicar o app do WhatsApp).
// O contato vem de CONTATO_PRIVACIDADE no .env, para não ficar fixo no código.
export default function Privacidade() {
  const contato = process.env.CONTATO_PRIVACIDADE;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="mb-10 flex justify-center">
        <LogoCompleta />
      </div>

      <article className="space-y-8 text-[15px] leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
        <header>
          <h1 className="text-2xl font-bold">Política de Privacidade</h1>
          <p className="mt-1 text-sm">Última atualização: {ATUALIZADA_EM}</p>
        </header>

        <section>
          <h2>O que é o Outflow</h2>
          <p>
            O Outflow é um controle de gastos pessoal e privado. Os gastos são enviados por mensagem de WhatsApp
            (texto ou áudio) a um número do serviço e exibidos num painel web acessível apenas por usuários
            convidados pelo administrador. Não há cadastro aberto ao público.
          </p>
        </section>

        <section>
          <h2>Quais dados coletamos</h2>
          <ul className="space-y-1">
            <li>
              <strong className="text-foreground">Mensagens enviadas ao bot:</strong> o texto ou o áudio da mensagem,
              o número de telefone do remetente e a data. Mensagens de números não autorizados são descartadas sem
              serem armazenadas.
            </li>
            <li>
              <strong className="text-foreground">Gastos:</strong> valor, descrição, categoria, forma de pagamento e
              data extraídos das mensagens.
            </li>
            <li>
              <strong className="text-foreground">Conta de acesso ao painel:</strong> nome, e-mail e senha (guardada
              apenas como hash criptográfico, nunca em texto).
            </li>
            <li>
              <strong className="text-foreground">Registros de acesso e segurança:</strong> ao abrir as páginas do
              painel, registramos endereço IP, localização aproximada pelo IP, navegador e características do
              dispositivo (tela, idioma, fuso horário, sistema). Também registramos logins, falhas de login e ações
              como apagar um gasto.
            </li>
          </ul>
        </section>

        <section>
          <h2>Para que usamos</h2>
          <ul className="space-y-1">
            <li>Registrar e exibir os gastos de quem os enviou.</li>
            <li>Responder às mensagens no WhatsApp com confirmações e resumos.</li>
            <li>Proteger o painel contra acessos indevidos e investigar incidentes de segurança.</li>
          </ul>
          <p className="mt-2">Os dados não são vendidos, não são usados para publicidade e não são compartilhados para outros fins.</p>
        </section>

        <section>
          <h2>Com quem os dados são processados</h2>
          <ul className="space-y-1">
            <li><strong className="text-foreground">Meta (WhatsApp Business Platform):</strong> entrega das mensagens.</li>
            <li>
              <strong className="text-foreground">Provedores de inteligência artificial:</strong> o texto das
              mensagens pode ser enviado à Anthropic (Claude) para identificar os gastos, e os áudios a um serviço de
              transcrição, apenas para processar a mensagem.
            </li>
            <li><strong className="text-foreground">Hospedagem e banco de dados:</strong> onde o painel e os dados ficam armazenados.</li>
            <li><strong className="text-foreground">Discord:</strong> recebe os registros de acesso e segurança, num canal privado do administrador.</li>
          </ul>
        </section>

        <section>
          <h2>Por quanto tempo guardamos</h2>
          <p>
            Os gastos ficam guardados até serem apagados pelo usuário. Sessões de acesso expiram em 30 dias.
            Registros de tentativas de login são descartados automaticamente após o período de bloqueio.
          </p>
        </section>

        <section id="exclusao-de-dados">
          <h2>Como excluir seus dados</h2>
          <ul className="space-y-1">
            <li>Para apagar o último gasto, envie <strong className="text-foreground">desfazer</strong> ao bot no WhatsApp.</li>
            <li>Qualquer gasto pode ser apagado pelo painel, no ícone de lixeira.</li>
            <li>
              Para excluir todos os seus dados (gastos, conta e número de telefone), solicite ao administrador
              {contato ? (
                <>
                  {" "}pelo e-mail <a className="font-medium text-foreground underline" href={`mailto:${contato}`}>{contato}</a>
                </>
              ) : null}
              . A exclusão é feita em até 15 dias.
            </li>
          </ul>
        </section>

        <section>
          <h2>Seus direitos</h2>
          <p>
            Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode pedir acesso, correção,
            portabilidade ou exclusão dos seus dados a qualquer momento
            {contato ? (
              <>
                {" "}pelo e-mail <a className="font-medium text-foreground underline" href={`mailto:${contato}`}>{contato}</a>
              </>
            ) : null}
            .
          </p>
        </section>

        <footer className="border-t pt-6 text-sm">
          <Link href="/login" className="text-primary underline">Voltar ao Outflow</Link>
        </footer>
      </article>
    </main>
  );
}
