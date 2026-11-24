// Modelos de bots do Hypercube: pontos de partida prontos para um agente com função fixa.
// Cada modelo vira um agente comum com a instrução abaixo como primeira tarefa.
import type { Papel } from './loja';

export type CategoriaBot = 'codigo' | 'releases' | 'suporte' | 'planejamento' | 'ops';

export const CATEGORIAS_BOT: { id: CategoriaBot; nome: string }[] = [
  { id: 'codigo', nome: 'Código' },
  { id: 'releases', nome: 'Releases e CI' },
  { id: 'suporte', nome: 'Suporte e triagem' },
  { id: 'planejamento', nome: 'Planejamento e docs' },
  { id: 'ops', nome: 'Ops' },
];

export type ItemVemCom = { tipo: 'skill' | 'gatilho' | 'integracao'; nome: string; desc?: string; estado?: string };

export type ModeloBot = {
  id: string;
  nome: string;
  categoria: CategoriaBot;
  /** Uma linha, na lista. */
  resumo: string;
  /** Mascote: cor do cubo e o acessório de um papel. */
  cor: string;
  acessorio: Papel;
  descricao: string;
  /** Prévia de uma conversa: o que o bot responde. */
  previa: string[];
  primeiro: string;
  vemCom: ItemVemCom[];
  /** Vira a primeira mensagem do agente. */
  instrucao: string;
  precisaConfigurar?: boolean;
};

const git: ItemVemCom = { tipo: 'integracao', nome: 'GitHub', estado: 'Não conectado' };

export const MODELOS_BOT: ModeloBot[] = [
  {
    id: 'revisao-pr',
    nome: 'Revisão de pull request',
    categoria: 'codigo',
    resumo: 'Revisa os pull requests que pedirem a você e lista as mudanças arriscadas.',
    cor: '#8A5BD6',
    acessorio: 'revisor',
    descricao: 'Revisa os pull requests que esperam a sua revisão e lista as mudanças de risco, com arquivo e linha.',
    previa: ['#4121: o contador de tentativas nunca zera, então uma segunda queda para as tentativas.', 'Nenhum teste cobre o caminho do novo tempo limite.'],
    primeiro: 'Pergunta quais repositórios cobrir, depois revisa os pull requests abertos e posta os achados aqui, com arquivo e linha. Não comenta no GitHub até você deixar.',
    vemCom: [
      { tipo: 'skill', nome: 'checklist-de-revisao', desc: 'Lê o diff atrás de mudança de comportamento, teste faltando e edição arriscada; cita cada achado.' },
      { tipo: 'gatilho', nome: 'Quando pedirem uma revisão', desc: 'Revisa e posta aqui', estado: 'Primeira conversa' },
      git,
    ],
    instrucao:
      'Você é um revisor de pull requests. Só leia, nunca altere código. Pergunte quais repositórios cobrir, revise cada pull request aberto e liste os achados do mais grave ao mais leve, cada um com arquivo:linha, a falha concreta e a correção. Não comente no GitHub sem eu mandar.',
  },
  {
    id: 'investigar-bug',
    nome: 'Investigação de bug',
    categoria: 'codigo',
    resumo: 'Reproduz um bug relatado e acha por onde ele começa.',
    cor: '#2E9C8F',
    acessorio: 'batedor',
    descricao: 'Reproduz um bug relatado e descobre onde ele nasce, sem mexer no código.',
    previa: ['Reproduzi: o total some o primeiro item quando a lista tem mais de um.', 'Começa em carrinho.js:4, o laço pula o índice 0.'],
    primeiro: 'Pede o relato do bug, tenta reproduzir, e devolve a causa provável com arquivo:linha e um teste que falha.',
    vemCom: [{ tipo: 'skill', nome: 'depurar-primeiro', desc: 'Diagnostica antes de editar e ranqueia hipóteses por evidência.' }],
    instrucao:
      'Você investiga bugs. Só leia e rode comandos de leitura. Peça o relato, reproduza, e devolva a causa provável com arquivo:linha, a prova (comando e resultado) e o que ainda é suspeita. Não corrija.',
  },
  {
    id: 'dependencias',
    nome: 'Atualização de dependências',
    categoria: 'codigo',
    resumo: 'Confere pacotes velhos e vulneráveis e propõe as atualizações.',
    cor: '#C2475A',
    acessorio: 'consertador',
    descricao: 'Confere pacotes desatualizados e vulneráveis e propõe atualizações, uma por vez, com os testes rodando.',
    previa: ['3 pacotes com aviso de segurança, 7 só desatualizados.', 'Proponho começar pelo que tem aviso e rodar os testes a cada troca.'],
    primeiro: 'Lista o que está velho ou vulnerável, ordena por risco e pergunta o que atualizar antes de mexer.',
    vemCom: [{ tipo: 'skill', nome: 'migracao-segura', desc: 'Atualiza em passos pequenos, com como voltar atrás.' }],
    instrucao:
      'Confira dependências desatualizadas e vulneráveis. Liste por risco e pergunte o que atualizar antes de alterar. Atualize um pacote por vez, rode os testes e mostre o resultado de cada passo.',
  },
  {
    id: 'trabalho-sem-olhar',
    nome: 'Trabalho de agente sem revisão',
    categoria: 'codigo',
    resumo: 'Uma lista diária do que os agentes terminaram e ninguém olhou ainda.',
    cor: '#C27A12',
    acessorio: 'construtor',
    descricao: 'Todo dia, lista o que os agentes terminaram e ninguém olhou ainda.',
    previa: ['2 branches prontas há mais de um dia: v/carrinho-frete e v/menu-contexto.', 'Nenhuma foi revisada.'],
    primeiro: 'Olha as cópias separadas (worktrees) do projeto e lista as que têm commits sem revisão.',
    vemCom: [{ tipo: 'gatilho', nome: 'Todo dia de manhã', desc: 'Lista e posta aqui', estado: 'Agendado' }],
    instrucao:
      'Liste as branches e cópias separadas do projeto que têm commits novos e ainda não foram revisadas. Diga quem as fez, há quanto tempo estão paradas e o que falta. Só leia.',
  },
  {
    id: 'faxina-workspaces',
    nome: 'Faxina de workspaces',
    categoria: 'codigo',
    resumo: 'Acha cópias de trabalho terminadas ou abandonadas e oferece para remover.',
    cor: '#E26D3F',
    acessorio: 'consertador',
    descricao: 'Acha cópias de trabalho terminadas ou abandonadas e oferece para remover, sempre pedindo antes.',
    previa: ['4 cópias sem commit novo há mais de 14 dias.', 'Posso remover as 2 já juntadas. As outras 2 têm trabalho sem commit.'],
    primeiro: 'Lista as cópias, mostra o que cada uma tem de não salvo e só remove o que você mandar.',
    vemCom: [],
    instrucao:
      'Liste as cópias de trabalho (worktrees) do projeto, diga o estado de cada uma (juntada, parada, com mudanças sem commit) e só remova o que eu aprovar, uma a uma. Nunca apague nada com trabalho sem commit.',
  },
  {
    id: 'seguranca',
    nome: 'Checagem de segurança',
    categoria: 'codigo',
    resumo: 'Olha as mudanças já juntadas atrás de segredo vazado e código arriscado.',
    cor: '#3550E8',
    acessorio: 'revisor',
    descricao: 'Olha as mudanças já juntadas atrás de segredo vazado e código arriscado.',
    previa: ['Achei uma chave em config.example.js:12.', 'Parece de exemplo, mas confirme antes de eu ignorar.'],
    primeiro: 'Varre o histórico recente, lista os achados com arquivo:linha e não mostra o valor de nenhum segredo.',
    vemCom: [git],
    instrucao:
      'Procure segredos vazados e código arriscado nas mudanças recentes. Só leia. Liste cada achado com arquivo:linha e gravidade, sem copiar o valor do segredo. Separe o que confirmou do que é suspeita.',
  },
  {
    id: 'pronto-release',
    nome: 'Pronto para lançar?',
    categoria: 'releases',
    resumo: 'Acompanha o que ainda trava o próximo lançamento.',
    cor: '#4CC38A',
    acessorio: 'lider',
    descricao: 'Acompanha o que ainda trava o próximo lançamento e diz se dá para lançar hoje.',
    previa: ['Falta 1 teste vermelho e 2 itens sem revisão.', 'Hoje não dá.'],
    primeiro: 'Roda os testes, confere as branches pendentes e responde sim ou não, com o motivo.',
    vemCom: [git],
    instrucao:
      'Diga se o projeto está pronto para lançar. Rode os testes, confira branches pendentes e itens sem revisão, e responda sim ou não com os motivos e a prova de cada um.',
  },
  {
    id: 'notas-release',
    nome: 'Notas de lançamento',
    categoria: 'releases',
    resumo: 'Rascunha as notas do próximo lançamento a partir do que foi juntado.',
    cor: '#93A4FF',
    acessorio: 'lider',
    descricao: 'Rascunha as notas do próximo lançamento a partir do que foi juntado, em linguagem de quem usa o app.',
    previa: ['Novo: menu do clique direito em todo o app.', 'Corrigido: o subtotal ignorava o primeiro item.'],
    primeiro: 'Lê os commits desde o último lançamento e agrupa em Novo, Melhorado e Corrigido.',
    vemCom: [git],
    instrucao:
      'Escreva o rascunho das notas do próximo lançamento a partir dos commits desde a última versão. Agrupe em Novo, Melhorado e Corrigido, em português simples, sem jargão.',
  },
  {
    id: 'falhas-ci',
    nome: 'Falhas de CI',
    categoria: 'releases',
    resumo: 'Explica as checagens que falharam e mantém uma lista das instáveis.',
    cor: '#E8505B',
    acessorio: 'batedor',
    descricao: 'Explica as checagens que falharam e mantém uma lista das que falham sem motivo.',
    previa: ['O teste de frete falhou por causa do arredondamento.', 'Esse é o terceiro a falhar assim esta semana.'],
    primeiro: 'Pede o link ou a saída da checagem, aponta a causa e marca as instáveis.',
    vemCom: [git],
    precisaConfigurar: true,
    instrucao:
      'Explique por que as checagens de CI falharam. Peça a saída da execução, aponte a causa com arquivo:linha e mantenha uma lista das que falham de forma intermitente.',
  },
  {
    id: 'triagem-issues',
    nome: 'Triagem de issues',
    categoria: 'suporte',
    resumo: 'Etiqueta issues novas, acha duplicadas e pede o que falta.',
    cor: '#8F7BD9',
    acessorio: 'batedor',
    descricao: 'Etiqueta issues novas, acha duplicadas e pede os detalhes que faltam.',
    previa: ['Issue #88 parece duplicada da #61.', 'Pedi a versão do app e os passos para reproduzir.'],
    primeiro: 'Lê as issues novas, sugere etiquetas e só escreve no GitHub quando você deixar.',
    vemCom: [git],
    instrucao:
      'Faça a triagem das issues novas: sugira etiquetas, aponte duplicadas e liste o que falta em cada uma. Não escreva no GitHub sem eu autorizar.',
  },
  {
    id: 'resumo-projetos',
    nome: 'Resumo dos projetos',
    categoria: 'planejamento',
    resumo: 'Um resumo semanal dos projetos que você escolher.',
    cor: '#E26D8E',
    acessorio: 'lider',
    descricao: 'Um resumo semanal dos projetos que você escolher: o que andou, o que travou e o que vem.',
    previa: ['Loja: frete e VIP prontos, falta decidir o cupom grande.', 'Hypercube: menu do clique direito em revisão.'],
    primeiro: 'Pergunta quais projetos acompanhar e monta o resumo a partir dos commits e das listas do Líder.',
    vemCom: [{ tipo: 'gatilho', nome: 'Toda segunda-feira', estado: 'Agendado' }],
    instrucao:
      'Monte um resumo semanal dos projetos que eu indicar: o que andou, o que travou e o que vem a seguir, com base nos commits e nas listas de trabalho.',
  },
  {
    id: 'docs-em-dia',
    nome: 'Documentação em dia',
    categoria: 'planejamento',
    resumo: 'Avisa quando a documentação não bate mais com o código juntado.',
    cor: '#E9A21B',
    acessorio: 'revisor',
    descricao: 'Avisa quando a documentação não bate mais com o código que foi juntado.',
    previa: ['O README ainda diz que o frete é R$ 10.', 'O código cobra R$ 15 (carrinho.js:19).'],
    primeiro: 'Compara docs e código, lista as diferenças com arquivo:linha e propõe o texto novo.',
    vemCom: [],
    instrucao:
      'Compare a documentação com o código atual e liste o que ficou desatualizado, cada item com arquivo:linha dos dois lados e o texto novo proposto. Não edite sem eu mandar.',
  },
  {
    id: 'rascunho-spec',
    nome: 'Rascunho de especificação',
    categoria: 'planejamento',
    resumo: 'Transforma uma conversa numa especificação curta para compartilhar.',
    cor: '#6E7BC8',
    acessorio: 'lider',
    descricao: 'Transforma uma discussão numa especificação curta, que dá para compartilhar.',
    previa: ['Objetivo: VIP ganha 5% depois do cupom.', 'Fora do escopo: níveis de VIP.'],
    primeiro: 'Pede a conversa ou as anotações e devolve objetivo, regras, casos de borda e o que fica de fora.',
    vemCom: [],
    instrucao:
      'Transforme a discussão que eu colar numa especificação curta: objetivo, regras, casos de borda, o que fica de fora e perguntas em aberto. Não invente regra de negócio; o que faltar vira pergunta.',
  },
  {
    id: 'limpar-backlog',
    nome: 'Faxina do backlog',
    categoria: 'planejamento',
    resumo: 'Acha itens parados, duplicados e sem dono.',
    cor: '#B06A3B',
    acessorio: 'construtor',
    descricao: 'Acha itens parados, duplicados e sem dono, e propõe o que fechar.',
    previa: ['5 itens sem mexer há 90 dias.', '2 parecem a mesma coisa.'],
    primeiro: 'Lista os itens suspeitos e pergunta antes de fechar qualquer um.',
    vemCom: [git],
    instrucao:
      'Procure itens parados, duplicados e sem dono no backlog. Liste cada um com o motivo e proponha o que fechar; só feche o que eu aprovar.',
  },
  {
    id: 'notas-incidente',
    nome: 'Notas de incidente',
    categoria: 'ops',
    resumo: 'Mantém a linha do tempo de um incidente e rascunha o relatório.',
    cor: '#7A8BA8',
    acessorio: 'batedor',
    descricao: 'Mantém a linha do tempo de um incidente e rascunha o relatório depois.',
    previa: ['14:02 o serviço parou de responder.', '14:20 voltou depois do reinício.'],
    primeiro: 'Abre uma linha do tempo, anota cada fato com a hora e, no fim, escreve o relatório.',
    vemCom: [],
    instrucao:
      'Mantenha a linha do tempo de um incidente: anote cada fato com a hora e a fonte, e ao final rascunhe o relatório (o que houve, impacto, causa, o que fazer para não repetir).',
  },
  {
    id: 'plantao',
    nome: 'Passagem de plantão',
    categoria: 'ops',
    resumo: 'Um resumo semanal de alertas, incidentes e pendências abertas.',
    cor: '#2E9C8F',
    acessorio: 'lider',
    descricao: 'Um resumo semanal de alertas, incidentes e pendências abertas, para quem assume o plantão.',
    previa: ['2 alertas abertos, 1 incidente sem relatório.'],
    primeiro: 'Pede onde ficam os alertas e monta o resumo de quem passa para quem.',
    vemCom: [{ tipo: 'integracao', nome: 'Alertas', estado: 'Não conectado' }],
    precisaConfigurar: true,
    instrucao:
      'Monte a passagem de plantão: alertas abertos, incidentes sem relatório e pendências, para quem assume. Pergunte onde ficam os alertas antes de começar.',
  },
];

/** Busca simples por nome, resumo e descrição, sem acento nem caixa. */
export function filtrarModelos(busca: string, categoria: CategoriaBot | 'todos'): ModeloBot[] {
  const limpo = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = limpo(busca.trim());
  return MODELOS_BOT.filter(
    (m) => (categoria === 'todos' || m.categoria === categoria) && (!q || limpo(`${m.nome} ${m.resumo} ${m.descricao}`).includes(q)),
  );
}
