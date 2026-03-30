export type CatalogKind = 'agent';
export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  kind: CatalogKind;
  link: string;
}

import { CATALOG_PAGE_SIZE } from './constants';
export const agentsCatalogPages: CatalogItem[][] = [
  // Page 1
  [
    {
      id: 'agent_api-designer_526db71bd2',
      title: 'api-designer',
      description:
        'REST and GraphQL API architect Agent category: 01-core-development. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/api-designer.md',
    },
    {
      id: 'agent_backend-developer_59a9f05e52',
      title: 'backend-developer',
      description:
        'Server-side expert for scalable APIs Agent category: 01-core-development. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/backend-developer.md',
    },
    {
      id: 'agent_electron-pro_4679210594',
      title: 'electron-pro',
      description:
        'Desktop application expert Agent category: 01-core-development. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/electron-pro.md',
    },
    {
      id: 'agent_frontend-developer_72ff52e3ec',
      title: 'frontend-developer',
      description:
        'UI/UX specialist for React, Vue, and Angular Agent category: 01-core-development. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/frontend-developer.md',
    },
    {
      id: 'agent_fullstack-developer_120eca79f7',
      title: 'fullstack-developer',
      description:
        'End-to-end feature development Agent category: 01-core-development. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/fullstack-developer.md',
    },
    {
      id: 'agent_typescript-pro_2488e03cb7',
      title: 'typescript-pro',
      description:
        'TypeScript specialist Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/typescript-pro.md',
    },
    {
      id: 'agent_react-specialist_97e834b8ec',
      title: 'react-specialist',
      description:
        'React 18+ modern patterns expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/react-specialist.md',
    },
    {
      id: 'agent_nextjs-developer_21c76f2b6b',
      title: 'nextjs-developer',
      description:
        'Next.js 14+ full-stack specialist Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/nextjs-developer.md',
    },
    {
      id: 'agent_python-pro_ae00a0ba3a',
      title: 'python-pro',
      description:
        'Python ecosystem master Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/python-pro.md',
    },
    {
      id: 'agent_golang-pro_1f60bd41fe',
      title: 'golang-pro',
      description:
        'Go concurrency specialist Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/golang-pro.md',
    },
    {
      id: 'agent_rust-engineer_50077c3305',
      title: 'rust-engineer',
      description:
        'Systems programming expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/rust-engineer.md',
    },
    {
      id: 'agent_javascript-pro_86917e4885',
      title: 'javascript-pro',
      description:
        'JavaScript development expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/javascript-pro.md',
    },
    {
      id: 'agent_docker-expert_52e2c445e3',
      title: 'docker-expert',
      description:
        'Docker containerization and optimization expert Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/docker-expert.md',
    },
    {
      id: 'agent_kubernetes-specialist_c2189c9df4',
      title: 'kubernetes-specialist',
      description:
        'Container orchestration master Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/kubernetes-specialist.md',
    },
    {
      id: 'agent_devops-engineer_aaaee48bdf',
      title: 'devops-engineer',
      description:
        'CI/CD and automation expert Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/devops-engineer.md',
    },
    {
      id: 'agent_sql-pro_e62f3fc64d',
      title: 'sql-pro',
      description:
        'Database query expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/sql-pro.md',
    },
    {
      id: 'agent_postgres-pro_43467205f7',
      title: 'postgres-pro',
      description:
        'PostgreSQL database expert Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/postgres-pro.md',
    },
    {
      id: 'agent_graphql-architect_a9e1506687',
      title: 'graphql-architect',
      description:
        'GraphQL schema and federation expert Agent category: 01-core-development. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/graphql-architect.md',
    },
    {
      id: 'agent_microservices-architect_109c61d313',
      title: 'microservices-architect',
      description:
        'Distributed systems designer Agent category: 01-core-development. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/microservices-architect.md',
    },
    {
      id: 'agent_mobile-developer_ee9d32b7a4',
      title: 'mobile-developer',
      description:
        'Cross-platform mobile specialist Agent category: 01-core-development. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/mobile-developer.md',
    },
    {
      id: 'agent_ui-designer_c1f7b30158',
      title: 'ui-designer',
      description:
        'Visual design and interaction specialist Agent category: 01-core-development. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/ui-designer.md',
    },
    {
      id: 'agent_websocket-engineer_7fa54d89b6',
      title: 'websocket-engineer',
      description:
        'Real-time communication specialist Agent category: 01-core-development. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/websocket-engineer.md',
    },
    {
      id: 'agent_angular-architect_f075c5b317',
      title: 'angular-architect',
      description:
        'Angular 15+ enterprise patterns expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/angular-architect.md',
    },
    {
      id: 'agent_cpp-pro_ba5184d249',
      title: 'cpp-pro',
      description:
        'C++ performance expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/cpp-pro.md',
    },
    {
      id: 'agent_csharp-developer_388f02777a',
      title: 'csharp-developer',
      description:
        '.NET ecosystem specialist Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/csharp-developer.md',
    },
    {
      id: 'agent_django-developer_1c3a9ecc69',
      title: 'django-developer',
      description:
        'Django 4+ web development expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/django-developer.md',
    },
    {
      id: 'agent_dotnet-core-expert_01408d87a1',
      title: 'dotnet-core-expert',
      description:
        '.NET 8 cross-platform specialist Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/dotnet-core-expert.md',
    },
    {
      id: 'agent_dotnet-framework-4-8-expert_252f7c201e',
      title: 'dotnet-framework-4.8-expert',
      description:
        '.NET Framework legacy enterprise specialist Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/dotnet-framework-4.8-expert.md',
    },
    {
      id: 'agent_elixir-expert_e2347d9c4e',
      title: 'elixir-expert',
      description:
        'Elixir and OTP fault-tolerant systems expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/elixir-expert.md',
    },
    {
      id: 'agent_flutter-expert_83317cc806',
      title: 'flutter-expert',
      description:
        'Flutter 3+ cross-platform mobile expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/flutter-expert.md',
    },
    {
      id: 'agent_java-architect_578d229210',
      title: 'java-architect',
      description:
        'Enterprise Java expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/java-architect.md',
    },
    {
      id: 'agent_kotlin-specialist_f806234e3f',
      title: 'kotlin-specialist',
      description:
        'Modern JVM language expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/kotlin-specialist.md',
    },
    {
      id: 'agent_laravel-specialist_aec9f16ad1',
      title: 'laravel-specialist',
      description:
        'Laravel 10+ PHP framework expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/laravel-specialist.md',
    },
    {
      id: 'agent_php-pro_afa5bf3e83',
      title: 'php-pro',
      description:
        'PHP web development expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/php-pro.md',
    },
    {
      id: 'agent_powershell-5-1-expert_a14f9ee387',
      title: 'powershell-5.1-expert',
      description:
        'Windows PowerShell 5.1 and full .NET Framework automation specialist Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/powershell-5.1-expert.md',
    },
    {
      id: 'agent_powershell-7-expert_875222d4ea',
      title: 'powershell-7-expert',
      description:
        'Cross-platform PowerShell 7+ automation and modern .NET specialist Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/powershell-7-expert.md',
    },
    {
      id: 'agent_rails-expert_f08962cbf1',
      title: 'rails-expert',
      description:
        'Rails 8.1 rapid development expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/rails-expert.md',
    },
    {
      id: 'agent_spring-boot-engineer_87ba439a4a',
      title: 'spring-boot-engineer',
      description:
        'Spring Boot 3+ microservices expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/spring-boot-engineer.md',
    },
    {
      id: 'agent_swift-expert_8febc581d9',
      title: 'swift-expert',
      description:
        'iOS and macOS specialist Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/swift-expert.md',
    },
    {
      id: 'agent_vue-expert_f63241e9c6',
      title: 'vue-expert',
      description:
        'Vue 3 Composition API expert Agent category: 02-language-specialists. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/vue-expert.md',
    },
    {
      id: 'agent_azure-infra-engineer_65eef8d389',
      title: 'azure-infra-engineer',
      description:
        'Azure infrastructure and Az PowerShell automation expert Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/azure-infra-engineer.md',
    },
    {
      id: 'agent_cloud-architect_af08c4c34f',
      title: 'cloud-architect',
      description:
        'AWS/GCP/Azure specialist Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/cloud-architect.md',
    },
    {
      id: 'agent_database-administrator_28c54a5b91',
      title: 'database-administrator',
      description:
        'Database management expert Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/database-administrator.md',
    },
    {
      id: 'agent_deployment-engineer_11821ff218',
      title: 'deployment-engineer',
      description:
        'Deployment automation specialist Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/deployment-engineer.md',
    },
    {
      id: 'agent_devops-incident-responder_4c4380976f',
      title: 'devops-incident-responder',
      description:
        'DevOps incident management Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/devops-incident-responder.md',
    },
    {
      id: 'agent_incident-responder_813cf4af1b',
      title: 'incident-responder',
      description:
        'System incident response expert Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/incident-responder.md',
    },
    {
      id: 'agent_network-engineer_8eb8b24b26',
      title: 'network-engineer',
      description:
        'Network infrastructure specialist Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/network-engineer.md',
    },
    {
      id: 'agent_platform-engineer_ce27eee4cd',
      title: 'platform-engineer',
      description:
        'Platform architecture expert Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/platform-engineer.md',
    },
    {
      id: 'agent_security-engineer_2c226da14d',
      title: 'security-engineer',
      description:
        'Infrastructure security specialist Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/security-engineer.md',
    },
    {
      id: 'agent_sre-engineer_2cc506d39c',
      title: 'sre-engineer',
      description:
        'Site reliability engineering expert Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/sre-engineer.md',
    },
    {
      id: 'agent_terraform-engineer_a1c6bcfd6c',
      title: 'terraform-engineer',
      description:
        'Infrastructure as Code expert Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/terraform-engineer.md',
    },
    {
      id: 'agent_terragrunt-expert_bf66137c2b',
      title: 'terragrunt-expert',
      description:
        'Terragrunt orchestration and DRY IaC specialist Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/terragrunt-expert.md',
    },
    {
      id: 'agent_windows-infra-admin_63016f7fa5',
      title: 'windows-infra-admin',
      description:
        'Active Directory, DNS, DHCP, and GPO automation specialist Agent category: 03-infrastructure. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/03-infrastructure/windows-infra-admin.md',
    },
    {
      id: 'agent_accessibility-tester_0cb1814966',
      title: 'accessibility-tester',
      description:
        'A11y compliance expert Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/accessibility-tester.md',
    },
    {
      id: 'agent_ad-security-reviewer_a6e5d65896',
      title: 'ad-security-reviewer',
      description:
        'Active Directory security and GPO audit specialist Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/ad-security-reviewer.md',
    },
    {
      id: 'agent_architect-reviewer_2b317cf540',
      title: 'architect-reviewer',
      description:
        'Architecture review specialist Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/architect-reviewer.md',
    },
    {
      id: 'agent_chaos-engineer_ef9f4b4cd9',
      title: 'chaos-engineer',
      description:
        'System resilience testing expert Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/chaos-engineer.md',
    },
    {
      id: 'agent_code-reviewer_e0912e49c9',
      title: 'code-reviewer',
      description:
        'Code quality guardian Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/code-reviewer.md',
    },
    {
      id: 'agent_compliance-auditor_589f185cc7',
      title: 'compliance-auditor',
      description:
        'Regulatory compliance expert Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/compliance-auditor.md',
    },
    {
      id: 'agent_debugger_81d45aecb3',
      title: 'debugger',
      description:
        'Advanced debugging specialist Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/debugger.md',
    },
    {
      id: 'agent_error-detective_36b4b8504b',
      title: 'error-detective',
      description:
        'Error analysis and resolution expert Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/error-detective.md',
    },
    {
      id: 'agent_penetration-tester_49a96d068f',
      title: 'penetration-tester',
      description:
        'Ethical hacking specialist Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/penetration-tester.md',
    },
    {
      id: 'agent_performance-engineer_49c25b9d64',
      title: 'performance-engineer',
      description:
        'Performance optimization expert Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/performance-engineer.md',
    },
    {
      id: 'agent_powershell-security-hardening_42d986bd9f',
      title: 'powershell-security-hardening',
      description:
        'PowerShell security hardening and compliance specialist Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/powershell-security-hardening.md',
    },
    {
      id: 'agent_qa-expert_9b5e1a5fb2',
      title: 'qa-expert',
      description:
        'Test automation specialist Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/qa-expert.md',
    },
    {
      id: 'agent_security-auditor_89aee6651d',
      title: 'security-auditor',
      description:
        'Security vulnerability expert Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/security-auditor.md',
    },
    {
      id: 'agent_test-automator_551e6c82b6',
      title: 'test-automator',
      description:
        'Test automation framework expert Agent category: 04-quality-security. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/04-quality-security/test-automator.md',
    },
    {
      id: 'agent_ai-engineer_ad721644cb',
      title: 'ai-engineer',
      description:
        'AI system design and deployment expert Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/ai-engineer.md',
    },
    {
      id: 'agent_data-analyst_2ba9118613',
      title: 'data-analyst',
      description:
        'Data insights and visualization specialist Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/data-analyst.md',
    },
    {
      id: 'agent_data-engineer_82d97e84e3',
      title: 'data-engineer',
      description:
        'Data pipeline architect Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/data-engineer.md',
    },
    {
      id: 'agent_data-scientist_4847215d52',
      title: 'data-scientist',
      description:
        'Analytics and insights expert Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/data-scientist.md',
    },
    {
      id: 'agent_database-optimizer_87ff04a6bd',
      title: 'database-optimizer',
      description:
        'Database performance specialist Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/database-optimizer.md',
    },
    {
      id: 'agent_llm-architect_9ad22f0f78',
      title: 'llm-architect',
      description:
        'Large language model architect Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/llm-architect.md',
    },
    {
      id: 'agent_machine-learning-engineer_3be958bbc5',
      title: 'machine-learning-engineer',
      description:
        'Machine learning systems expert Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/machine-learning-engineer.md',
    },
    {
      id: 'agent_ml-engineer_231bd3a8a4',
      title: 'ml-engineer',
      description:
        'Machine learning specialist Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/ml-engineer.md',
    },
    {
      id: 'agent_mlops-engineer_014fd98725',
      title: 'mlops-engineer',
      description:
        'MLOps and model deployment expert Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/mlops-engineer.md',
    },
    {
      id: 'agent_nlp-engineer_76a2afffdd',
      title: 'nlp-engineer',
      description:
        'Natural language processing expert Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/nlp-engineer.md',
    },
    {
      id: 'agent_prompt-engineer_9bbfb656e4',
      title: 'prompt-engineer',
      description:
        'Prompt optimization specialist Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/prompt-engineer.md',
    },
    {
      id: 'agent_reinforcement-learning-engineer_ffda8b9d47',
      title: 'reinforcement-learning-engineer',
      description:
        'Reinforcement learning and agent training expert Agent category: 05-data-ai. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/05-data-ai/reinforcement-learning-engineer.md',
    },
    {
      id: 'agent_build-engineer_6db0cdf1ea',
      title: 'build-engineer',
      description:
        'Build system specialist Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/build-engineer.md',
    },
    {
      id: 'agent_cli-developer_7fc968b353',
      title: 'cli-developer',
      description:
        'Command-line tool creator Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/cli-developer.md',
    },
    {
      id: 'agent_dependency-manager_c919722181',
      title: 'dependency-manager',
      description:
        'Package and dependency specialist Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/dependency-manager.md',
    },
    {
      id: 'agent_documentation-engineer_03dad04e2b',
      title: 'documentation-engineer',
      description:
        'Technical documentation expert Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/documentation-engineer.md',
    },
    {
      id: 'agent_dx-optimizer_9da896bd49',
      title: 'dx-optimizer',
      description:
        'Developer experience optimization specialist Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/dx-optimizer.md',
    },
    {
      id: 'agent_git-workflow-manager_5c8aa0e99c',
      title: 'git-workflow-manager',
      description:
        'Git workflow and branching expert Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/git-workflow-manager.md',
    },
    {
      id: 'agent_legacy-modernizer_6f10a1ee2f',
      title: 'legacy-modernizer',
      description:
        'Legacy code modernization specialist Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/legacy-modernizer.md',
    },
    {
      id: 'agent_mcp-developer_1b2aa45061',
      title: 'mcp-developer',
      description:
        'Model Context Protocol specialist Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/mcp-developer.md',
    },
    {
      id: 'agent_powershell-module-architect_f319cf8e2f',
      title: 'powershell-module-architect',
      description:
        'PowerShell module and profile architecture specialist Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/powershell-module-architect.md',
    },
    {
      id: 'agent_powershell-ui-architect_4df8ea7555',
      title: 'powershell-ui-architect',
      description:
        'PowerShell UI/UX specialist for WinForms, WPF, Metro frameworks, and TUIs Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/powershell-ui-architect.md',
    },
    {
      id: 'agent_refactoring-specialist_8d5c17b094',
      title: 'refactoring-specialist',
      description:
        'Code refactoring expert Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/refactoring-specialist.md',
    },
    {
      id: 'agent_slack-expert_b518b7b501',
      title: 'slack-expert',
      description:
        'Slack platform and @slack/bolt specialist Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/slack-expert.md',
    },
    {
      id: 'agent_tooling-engineer_00971b8541',
      title: 'tooling-engineer',
      description:
        'Developer tooling specialist Agent category: 06-developer-experience. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/tooling-engineer.md',
    },
    {
      id: 'agent_api-documenter_ddbb59eb2e',
      title: 'api-documenter',
      description:
        'API documentation specialist Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/api-documenter.md',
    },
    {
      id: 'agent_blockchain-developer_3aeb9e6db6',
      title: 'blockchain-developer',
      description:
        'Web3 and crypto specialist Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/blockchain-developer.md',
    },
    {
      id: 'agent_embedded-systems_90f8213e31',
      title: 'embedded-systems',
      description:
        'Embedded and real-time systems expert Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/embedded-systems.md',
    },
    {
      id: 'agent_fintech-engineer_52c6758e75',
      title: 'fintech-engineer',
      description:
        'Financial technology specialist Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/fintech-engineer.md',
    },
    {
      id: 'agent_game-developer_5f9631e9e8',
      title: 'game-developer',
      description:
        'Game development expert Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/game-developer.md',
    },
    {
      id: 'agent_iot-engineer_40224d54e2',
      title: 'iot-engineer',
      description:
        'IoT systems developer Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/iot-engineer.md',
    },
    {
      id: 'agent_m365-admin_b835cac9fd',
      title: 'm365-admin',
      description:
        'Microsoft 365, Exchange Online, Teams, and SharePoint administration specialist Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/m365-admin.md',
    },
    {
      id: 'agent_mobile-app-developer_b228d4de5d',
      title: 'mobile-app-developer',
      description:
        'Mobile application specialist Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/mobile-app-developer.md',
    },
  ],
  // Page 2
  [
    {
      id: 'agent_payment-integration_452ce0859f',
      title: 'payment-integration',
      description:
        'Payment systems expert Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/payment-integration.md',
    },
    {
      id: 'agent_quant-analyst_3d15160672',
      title: 'quant-analyst',
      description:
        'Quantitative analysis specialist Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/quant-analyst.md',
    },
    {
      id: 'agent_risk-manager_5ccf5c15d6',
      title: 'risk-manager',
      description:
        'Risk assessment and management expert Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/risk-manager.md',
    },
    {
      id: 'agent_seo-specialist_b8998fb0af',
      title: 'seo-specialist',
      description:
        'Search engine optimization expert Agent category: 07-specialized-domains. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/07-specialized-domains/seo-specialist.md',
    },
    {
      id: 'agent_business-analyst_e64dd9b882',
      title: 'business-analyst',
      description:
        'Requirements specialist Agent category: 08-business-product. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/08-business-product/business-analyst.md',
    },
    {
      id: 'agent_content-marketer_4ae8c88596',
      title: 'content-marketer',
      description:
        'Content marketing specialist Agent category: 08-business-product. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/08-business-product/content-marketer.md',
    },
    {
      id: 'agent_customer-success-manager_ff48ab0467',
      title: 'customer-success-manager',
      description:
        'Customer success expert Agent category: 08-business-product. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/08-business-product/customer-success-manager.md',
    },
    {
      id: 'agent_legal-advisor_1678c8b42f',
      title: 'legal-advisor',
      description:
        'Legal and compliance specialist Agent category: 08-business-product. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/08-business-product/legal-advisor.md',
    },
    {
      id: 'agent_product-manager_246b0ad757',
      title: 'product-manager',
      description:
        'Product strategy expert Agent category: 08-business-product. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/08-business-product/product-manager.md',
    },
    {
      id: 'agent_project-manager_5787e8174a',
      title: 'project-manager',
      description:
        'Project management specialist Agent category: 08-business-product. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/08-business-product/project-manager.md',
    },
    {
      id: 'agent_sales-engineer_1a8334a1dd',
      title: 'sales-engineer',
      description:
        'Technical sales expert Agent category: 08-business-product. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/08-business-product/sales-engineer.md',
    },
    {
      id: 'agent_scrum-master_165cab3f81',
      title: 'scrum-master',
      description:
        'Agile methodology expert Agent category: 08-business-product. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/08-business-product/scrum-master.md',
    },
    {
      id: 'agent_technical-writer_3abfa67b27',
      title: 'technical-writer',
      description:
        'Technical documentation specialist Agent category: 08-business-product. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/08-business-product/technical-writer.md',
    },
    {
      id: 'agent_ux-researcher_4dc9553506',
      title: 'ux-researcher',
      description:
        'User research expert Agent category: 08-business-product. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/08-business-product/ux-researcher.md',
    },
    {
      id: 'agent_wordpress-master_578bd5d128',
      title: 'wordpress-master',
      description:
        'WordPress development and optimization expert Agent category: 08-business-product. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/08-business-product/wordpress-master.md',
    },
    {
      id: 'agent_agent-installer_744d1480b4',
      title: 'agent-installer',
      description:
        'Browse and install agents from this repository via GitHub Agent category: 09-meta-orchestration. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/09-meta-orchestration/agent-installer.md',
    },
    {
      id: 'agent_agent-organizer_8394c4aeb4',
      title: 'agent-organizer',
      description:
        'Multi-agent coordinator Agent category: 09-meta-orchestration. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/09-meta-orchestration/agent-organizer.md',
    },
    {
      id: 'agent_context-manager_f1f5abc655',
      title: 'context-manager',
      description:
        'Context optimization expert Agent category: 09-meta-orchestration. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/09-meta-orchestration/context-manager.md',
    },
    {
      id: 'agent_error-coordinator_ce228be4db',
      title: 'error-coordinator',
      description:
        'Error handling and recovery specialist Agent category: 09-meta-orchestration. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/09-meta-orchestration/error-coordinator.md',
    },
    {
      id: 'agent_it-ops-orchestrator_ee5e4f390b',
      title: 'it-ops-orchestrator',
      description:
        'IT operations workflow orchestration specialist Agent category: 09-meta-orchestration. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/09-meta-orchestration/it-ops-orchestrator.md',
    },
    {
      id: 'agent_knowledge-synthesizer_db3780f17f',
      title: 'knowledge-synthesizer',
      description:
        'Knowledge aggregation expert Agent category: 09-meta-orchestration. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/09-meta-orchestration/knowledge-synthesizer.md',
    },
    {
      id: 'agent_multi-agent-coordinator_381471234d',
      title: 'multi-agent-coordinator',
      description:
        'Advanced multi-agent orchestration Agent category: 09-meta-orchestration. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/09-meta-orchestration/multi-agent-coordinator.md',
    },
    {
      id: 'agent_performance-monitor_b06ccf32d9',
      title: 'performance-monitor',
      description:
        'Agent performance optimization Agent category: 09-meta-orchestration. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/09-meta-orchestration/performance-monitor.md',
    },
    {
      id: 'agent_task-distributor_a2f629676f',
      title: 'task-distributor',
      description:
        'Task allocation specialist Agent category: 09-meta-orchestration. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/09-meta-orchestration/task-distributor.md',
    },
    {
      id: 'agent_workflow-orchestrator_b062b3b575',
      title: 'workflow-orchestrator',
      description:
        'Complex workflow automation Agent category: 09-meta-orchestration. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/09-meta-orchestration/workflow-orchestrator.md',
    },
    {
      id: 'agent_pied-piper_c2edf76c07',
      title: 'pied-piper',
      description:
        'Orchestrate Team of AI Subagents for repetitive SDLC workflows Agent category: 09-meta-orchestration (external). Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/sathish316/pied-piper',
    },
    {
      id: 'agent_taskade_6430f82b58',
      title: 'taskade',
      description:
        'AI-powered workspace with autonomous agents, real-time collaboration, and workflow automation with MCP integration Agent category: 09-meta-orchestration (external). Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/taskade/mcp',
    },
    {
      id: 'agent_competitive-analyst_169ac87572',
      title: 'competitive-analyst',
      description:
        'Competitive intelligence specialist Agent category: 10-research-analysis. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/10-research-analysis/competitive-analyst.md',
    },
    {
      id: 'agent_data-researcher_004af58455',
      title: 'data-researcher',
      description:
        'Data discovery and analysis expert Agent category: 10-research-analysis. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/10-research-analysis/data-researcher.md',
    },
    {
      id: 'agent_market-researcher_5e8e1dd938',
      title: 'market-researcher',
      description:
        'Market analysis and consumer insights Agent category: 10-research-analysis. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/10-research-analysis/market-researcher.md',
    },
    {
      id: 'agent_research-analyst_2f2ab5f93d',
      title: 'research-analyst',
      description:
        'Comprehensive research specialist Agent category: 10-research-analysis. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/10-research-analysis/research-analyst.md',
    },
    {
      id: 'agent_scientific-literature-researcher_1bcc5cb239',
      title: 'scientific-literature-researcher',
      description:
        'Scientific paper search and evidence synthesis via [BGPT MCP](https://github.com/connerlambden/bgpt-mcp) Agent category: 10-research-analysis. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/10-research-analysis/scientific-literature-researcher.md',
    },
    {
      id: 'agent_search-specialist_770d39ef5d',
      title: 'search-specialist',
      description:
        'Advanced information retrieval expert Agent category: 10-research-analysis. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/10-research-analysis/search-specialist.md',
    },
    {
      id: 'agent_trend-analyst_e2cf047fb0',
      title: 'trend-analyst',
      description:
        'Emerging trends and forecasting expert Agent category: 10-research-analysis. Source: VoltAgent awesome claude code subagents.',
      kind: 'agent',
      link: 'https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/10-research-analysis/trend-analyst.md',
    },
    {
      id: 'agent_frontend-developer_2a8bd2486f',
      title: 'Frontend Developer',
      description: 'Frontend Developer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/frontend-developer.md',
    },
    {
      id: 'agent_backend-developer_cf34e462ac',
      title: 'Backend Developer',
      description: 'Backend Developer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/backend-developer.md',
    },
    {
      id: 'agent_api-developer_7781de729a',
      title: 'API Developer',
      description: 'API Developer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/api-developer.md',
    },
    {
      id: 'agent_mobile-developer_e3694688fb',
      title: 'Mobile Developer',
      description: 'Mobile Developer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/mobile-developer.md',
    },
    {
      id: 'agent_python-developer_c64569c53a',
      title: 'Python Developer',
      description: 'Python Developer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/python-developer.md',
    },
    {
      id: 'agent_javascript-developer_ef0fb38ac5',
      title: 'JavaScript Developer',
      description: 'JavaScript Developer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/javascript-developer.md',
    },
    {
      id: 'agent_typescript-developer_d600238cc7',
      title: 'TypeScript Developer',
      description: 'TypeScript Developer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/typescript-developer.md',
    },
    {
      id: 'agent_php-developer_1acf102f64',
      title: 'PHP Developer',
      description: 'PHP Developer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/php-developer.md',
    },
    {
      id: 'agent_wordpress-developer_3d1f82d873',
      title: 'WordPress Developer',
      description: 'WordPress Developer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/wordpress-developer.md',
    },
    {
      id: 'agent_ios-developer_01d104f3bd',
      title: 'iOS Developer',
      description: 'iOS Developer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/ios-developer.md',
    },
    {
      id: 'agent_database-designer_e6b9d17395',
      title: 'Database Designer',
      description: 'Database Designer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/database-designer.md',
    },
    {
      id: 'agent_code-reviewer_88a6ee082c',
      title: 'Code Reviewer',
      description: 'Code Reviewer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/code-reviewer.md',
    },
    {
      id: 'agent_code-debugger_0bf7e6ed22',
      title: 'Code Debugger',
      description: 'Code Debugger subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/code-debugger.md',
    },
    {
      id: 'agent_code-documenter_3a77658876',
      title: 'Code Documenter',
      description: 'Code Documenter subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/code-documenter.md',
    },
    {
      id: 'agent_code-refactor_93928975cb',
      title: 'Code Refactor',
      description: 'Code Refactor subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/code-refactor.md',
    },
    {
      id: 'agent_code-security-auditor_5e7eb7c5e2',
      title: 'Code Security Auditor',
      description: 'Code Security Auditor subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/code-security-auditor.md',
    },
    {
      id: 'agent_code-standards-enforcer_52cf5fcafe',
      title: 'Code Standards Enforcer',
      description: 'Code Standards Enforcer subagent from Njengah claude-code-cheat-sheet.',
      kind: 'agent',
      link: 'https://github.com/Njengah/claude-code-cheat-sheet/blob/main/subagents/code-standards-enforcer.md',
    },
    {
      id: 'agent_cs-growth-strategist_0c56b39bea',
      title: 'cs-growth-strategist',
      description: 'cs-growth-strategist agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/business-growth/cs-growth-strategist.md',
    },
    {
      id: 'agent_cs-ceo-advisor_8751dabcce',
      title: 'cs-ceo-advisor',
      description: 'cs-ceo-advisor agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/c-level/cs-ceo-advisor.md',
    },
    {
      id: 'agent_cs-cto-advisor_8c173b8fd8',
      title: 'cs-cto-advisor',
      description: 'cs-cto-advisor agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/c-level/cs-cto-advisor.md',
    },
    {
      id: 'agent_cs-engineering-lead_2310f557dd',
      title: 'cs-engineering-lead',
      description: 'cs-engineering-lead agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/engineering-team/cs-engineering-lead.md',
    },
    {
      id: 'agent_cs-workspace-admin_90f99ec603',
      title: 'cs-workspace-admin',
      description: 'cs-workspace-admin agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/engineering-team/cs-workspace-admin.md',
    },
    {
      id: 'agent_cs-senior-engineer_500ce480c9',
      title: 'cs-senior-engineer',
      description: 'cs-senior-engineer agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/engineering/cs-senior-engineer.md',
    },
    {
      id: 'agent_cs-financial-analyst_5d5b9a31b3',
      title: 'cs-financial-analyst',
      description: 'cs-financial-analyst agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/finance/cs-financial-analyst.md',
    },
    {
      id: 'agent_cs-content-creator_e578a92c2e',
      title: 'cs-content-creator',
      description: 'cs-content-creator agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/marketing/cs-content-creator.md',
    },
    {
      id: 'agent_cs-demand-gen-specialist_0be5984904',
      title: 'cs-demand-gen-specialist',
      description: 'cs-demand-gen-specialist agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/marketing/cs-demand-gen-specialist.md',
    },
    {
      id: 'agent_content-strategist_18dba5517d',
      title: 'content-strategist',
      description: 'content-strategist agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/personas/content-strategist.md',
    },
    {
      id: 'agent_devops-engineer_edb71e4082',
      title: 'devops-engineer',
      description: 'devops-engineer agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/personas/devops-engineer.md',
    },
    {
      id: 'agent_finance-lead_677f4c0b88',
      title: 'finance-lead',
      description: 'finance-lead agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/personas/finance-lead.md',
    },
    {
      id: 'agent_growth-marketer_937b5f2aee',
      title: 'growth-marketer',
      description: 'growth-marketer agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/personas/growth-marketer.md',
    },
    {
      id: 'agent_product-manager_663e3ba97f',
      title: 'product-manager',
      description: 'product-manager agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/personas/product-manager.md',
    },
    {
      id: 'agent_solo-founder_4992597e0e',
      title: 'solo-founder',
      description: 'solo-founder agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/personas/solo-founder.md',
    },
    {
      id: 'agent_startup-cto_e095bf586c',
      title: 'startup-cto',
      description: 'startup-cto agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/personas/startup-cto.md',
    },
    {
      id: 'agent_cs-agile-product-owner_f824ca0c8f',
      title: 'cs-agile-product-owner',
      description: 'cs-agile-product-owner agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/product/cs-agile-product-owner.md',
    },
    {
      id: 'agent_cs-product-analyst_238a736627',
      title: 'cs-product-analyst',
      description: 'cs-product-analyst agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/product/cs-product-analyst.md',
    },
    {
      id: 'agent_cs-product-manager_f4a514e12b',
      title: 'cs-product-manager',
      description: 'cs-product-manager agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/product/cs-product-manager.md',
    },
    {
      id: 'agent_cs-product-strategist_f2d47eb114',
      title: 'cs-product-strategist',
      description: 'cs-product-strategist agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/product/cs-product-strategist.md',
    },
    {
      id: 'agent_cs-ux-researcher_d169d466be',
      title: 'cs-ux-researcher',
      description: 'cs-ux-researcher agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/product/cs-ux-researcher.md',
    },
    {
      id: 'agent_cs-project-manager_7161e396ed',
      title: 'cs-project-manager',
      description: 'cs-project-manager agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/project-management/cs-project-manager.md',
    },
    {
      id: 'agent_cs-quality-regulatory_5c8d369654',
      title: 'cs-quality-regulatory',
      description: 'cs-quality-regulatory agent from joeking-ly claude-skills-arsenal.',
      kind: 'agent',
      link: 'https://github.com/joeking-ly/claude-skills-arsenal/blob/main/skills/agents/ra-qm-team/cs-quality-regulatory.md',
    },
    {
      id: 'agent_obra-testing-skills-with-subagents_38b8770b49',
      title: 'obra/testing-skills-with-subagents',
      description:
        'obra/testing-skills-with-subagents agent for Claude workflows from VoltAgent/awesome-agent-skills.',
      kind: 'agent',
      link: 'https://github.com/obra/superpowers/blob/main/skills/testing-skills-with-subagents/SKILL.md',
    },
  ],
];

export const agents: CatalogItem[] = agentsCatalogPages.flat();
export const agentsTotalItems = agents.length;
export const agentsTotalPages = agentsCatalogPages.length;
