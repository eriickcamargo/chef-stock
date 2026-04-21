# ChefStock

Sistema de controle de estoque para o restaurante **Gosto Paraense**. SPA em JavaScript puro com Firebase como backend — sem servidor próprio, sem build step.

## Funcionalidades

- **Estoque em tempo real** com níveis crítico / baixo / normal e alertas automáticos
- **Recebimento de mercadorias** com entrada manual ou importação de XML NF-e
- **Solicitações** — fluxo completo do pedido do trailer/cozinha até a entrega
- **Fichas de produção** — baixa automática de ingredientes ao finalizar
- **Conferência de inventário** em modo cego (contador não vê os valores do sistema)
- **Consumo interno** — registro imutável de uso por setor
- **Relatórios e CMV** com gráficos de tendência, análise por fornecedor e custo de produção
- **Estoque por local** — rastreamento de distribuição em múltiplos pontos de armazenamento
- **Busca global** com atalho `Ctrl+K`
- **Alertas via Telegram** — bot envia notificações de estoque crítico e responde `/lista_de_compras`

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5 + CSS3 + JavaScript (vanilla) |
| Banco de dados | Cloud Firestore |
| Autenticação | Firebase Auth (e-mail/senha) |
| Hospedagem | Firebase Hosting |
| Gráficos | Chart.js v4.4.0 |
| CI/CD | GitHub Actions |

## Perfis de acesso

| Role | Descrição | Acesso principal |
|------|-----------|-----------------|
| `adm` | Administrador | Acesso total — usuários, configurações, relatórios, aprovações |
| `coz` | Cozinha | Recebimento, produção, solicitações, conferência (setor cozinha) |
| `trl` | Trailer | Solicitar itens, conferência (setor trailer), consumo |
| `conf` | Conferente | Inventários, relatórios, visualização de estoque |

Permissões são aplicadas tanto no frontend quanto nas **Firestore Security Rules** (`firestore.rules`).

## Estrutura do projeto

```
/
├── index.html                  # Entrada da aplicação
├── firebase.json               # Hosting + Firestore
├── firestore.rules             # Regras de segurança
├── css/
│   └── styles.css
├── js/
│   ├── firebase-config.js      # Inicialização do SDK
│   ├── auth.js                 # Login e sessão
│   ├── data.js                 # Estado global e carregamento de dados
│   ├── nav.js                  # Navegação por role
│   ├── crud.js                 # CRUD de itens de estoque
│   ├── utils.js                # Helpers e formatação
│   ├── notifications.js        # Alertas em tempo real + bot Telegram
│   ├── globalSearch.js         # Busca global
│   └── pages/
│       ├── dashboard.js
│       ├── estoque.js
│       ├── estoqueLocal.js
│       ├── recebimento.js
│       ├── solicitacoes.js
│       ├── producao.js
│       ├── conferencia.js
│       ├── consumo.js
│       ├── cardapio.js
│       ├── categorias.js
│       ├── locais.js
│       ├── fornecedores.js
│       ├── usuarios.js
│       ├── relatorios.js
│       └── trailer.js
└── .github/workflows/          # Deploy automático via GitHub Actions
```

## Collections do Firestore

| Collection | Descrição |
|------------|-----------|
| `usuarios` | Perfis e roles dos usuários |
| `tipos` | Agrupadores de estoque (insumos, bebidas, pratos…) |
| `itens` | Itens de estoque com distribuição por local |
| `fornecedores` | Cadastro de fornecedores |
| `recebimentos` | Notas de entrada de mercadorias |
| `solicitacoes` | Pedidos do trailer/cozinha |
| `producoes` | Fichas de produção finalizadas |
| `conferencias` | Sessões de inventário |
| `consumos` | Registros de consumo interno (imutável) |
| `atividades` | Log de auditoria (imutável) |
| `cardapio` | Itens do cardápio para referência de produção |
| `locais` | Pontos de armazenamento (setor Cozinha / Trailer) |
| `configuracoes` | Configurações globais (token do bot Telegram) |

## Deploy

O deploy é feito automaticamente pelo GitHub Actions:

- **Push na branch `main`** → publica no canal `live`
- **Pull request** → gera URL de preview e comenta no PR

### Configuração inicial

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com)
2. Ative **Firestore** (modo nativo) e **Authentication** (e-mail/senha)
3. Publique as regras de segurança:
   ```bash
   firebase deploy --only firestore:rules
   ```
4. Adicione o secret `FIREBASE_SERVICE_ACCOUNT_<PROJECT_ID>` no repositório GitHub (Settings → Secrets → Actions)
5. Faça o deploy manual na primeira vez:
   ```bash
   firebase deploy --only hosting
   ```

### Bot do Telegram (opcional)

1. Crie um bot via [@BotFather](https://t.me/BotFather) e copie o token
2. Descubra o Chat ID do grupo/canal desejado
3. No app, acesse **Configurações → Alertas Telegram** (perfil `adm`) e insira as credenciais

O bot responde ao comando `/lista_de_compras` com os itens em nível crítico agrupados por fornecedor.

## Login

O domínio `@chefstock.app` é aplicado automaticamente — basta digitar o usuário sem o e-mail completo.

```
usuário: admin
senha:   ••••••
```
