# GitLab HackerOne Bug Bounty Policy & Research Rules of Engagement

- **Program Host**: HackerOne (`https://hackerone.com/gitlab`)
- **Official Policy Reference**: GitLab Trust Center & Official HackerOne Program Policy
- **Target Scope**: GitLab Community Edition (CE), Enterprise Edition (EE), and SaaS Infrastructure
- **Lab Research Classification**: Authorized Local Security Research Environment
- **Authoritative Version**: GitLab CE `v17.3.0`

---

## 1. Program Overview & In-Scope Asset Taxonomy

The GitLab Bug Bounty Program operates on HackerOne to incentivize good-faith security researchers to identify, validate, and responsibly disclose security vulnerabilities in the GitLab software ecosystem and managed cloud infrastructure.

### 1.1 In-Scope Assets

The following target assets are formally in-scope for security research and bounty evaluation:

| Asset Category | Target Identifier | Description & Research Boundary |
|---|---|---|
| **GitLab SaaS Core** | `https://gitlab.com` | Primary multi-tenant SaaS application, REST API (`/api/v4`), and GraphQL API (`/api/graphql`). Research restricted to researcher-owned namespaces. |
| **Container Registry** | `registry.gitlab.com` | Docker & OCI container registry service integrated with GitLab CI/CD authentication. |
| **Customer Portal** | `customers.gitlab.com` | Subscription, cloud licensing, and account management portal. |
| **GitLab Pages** | `pages.gitlab.io` | Static site hosting infrastructure for user projects. |
| **Core Source Code** | `gitlab-org/gitlab` | Community Edition (CE) and Enterprise Edition (EE) repository baseline (`app/`, `lib/`, `ee/`). |
| **Git Storage RPC** | `gitlab-org/gitaly` | High-performance gRPC Git storage daemon and RPC interface handlers. |
| **CI/CD Execution** | `gitlab-org/gitlab-runner` | CI/CD build execution agent across Docker, Kubernetes, and shell executors. |
| **SSH Gateway** | `gitlab-org/gitlab-shell` | SSH authentication and command routing daemon. |
| **HTTP Accelerator** | `gitlab-org/gitlab-workhorse`| Smart Go reverse proxy handling Git over HTTP, large file uploads, and raw streaming. |
| **IDE Extensions** | `gitlab-org/gitlab-vscode-extension` | Official Visual Studio Code extension integrating GitLab Workflow API. |
| **Local Lab Deployments** | `gitlab_research_lab` | Self-hosted Community Edition v17.3.0 instances reproducing core codebase flaws. |

### 1.2 Out-of-Scope Assets & Excluded Vulnerability Categories

Research against the following categories is strictly **OUT OF SCOPE**, ineligible for bounty awards, and constitutes a violation of the Rules of Engagement:

1. **Denial of Service (DoS / DDoS)**:
   - Application-layer resource exhaustion, CPU/memory starvation, regex catastrophic backtracking (ReDoS) without systemic privilege escalation, volumetric packet flooding, or connection pool exhaustion.
2. **Automated Volumetric Scanning**:
   - Unthrottled automated web application scanning (e.g., Nessus, Qualys, Acunetix, sqlmap brute-force, Nuclei flood) against GitLab.com or SaaS assets without explicit written authorization.
3. **Social Engineering & Phishing**:
   - Phishing, vishing, smishing, pretexting, or social engineering targeting GitLab team members, contractors, contributors, or customers.
4. **Physical & Infrastructure Security**:
   - Physical penetration testing against GitLab facilities, co-location data centers, hardware, or office networks.
5. **Third-Party SaaS Integrations**:
   - Attacks against third-party vendors and service providers utilized by GitLab (e.g., Zendesk, Salesforce, Marketo, Google Workspace, Slack) unless demonstrating direct leak of GitLab master credentials or cross-tenant data.
6. **Regional / Forked Distributions**:
   - JiHu GitLab (`gitlab.cn`) and proprietary regional third-party distributions.
7. **Standalone Prompt Injection**:
   - Large Language Model (LLM) prompt injection that does not breach defined tenant boundaries or execute unauthorized backend API mutations.
8. **Low-Impact Informational Disclosures**:
   - Public version number banners, standard TLS cipher negotiation strings, non-sensitive error stack traces lacking internal data exposure, or SPF/DKIM/DMARC DNS records without demonstrable mail spoofing impact.
9. **Misconfigurations on Self-Managed Instances**:
   - Insecure deployment configurations resulting from user error rather than insecure default settings in the upstream GitLab distribution.

---

## 2. Rules of Engagement & Gold Standard Safe Harbor

### 2.1 HackerOne Gold Standard Safe Harbor Protections

GitLab adheres strictly to HackerOne's **Gold Standard Safe Harbor** framework to protect ethical security researchers:

- **Legal Immunity & Authorization**: GitLab considers security research activities conducted in good faith and in full compliance with this policy to be authorized conduct under all relevant computer fraud and cybercrime laws, including the Computer Fraud and Abuse Act (CFAA, 18 U.S.C. § 1030) and DMCA Section 1201 anti-circumvention exemptions.
- **Third-Party Legal Defense Assistance**: If a third party initiates legal action or requests criminal investigation against a researcher for activities conducted within the bounds of this policy, GitLab will take formal steps to clarify and attest that the researcher acted with GitLab's explicit authorization.
- **Good-Faith Research Standard**: Research is conducted in good faith when the sole purpose is to discover, model, and report security vulnerabilities while avoiding data corruption, privacy violations, operational disruption, or harm to individuals.

### 2.2 Operational Rules of Engagement (RoE)

Researchers must strictly adhere to the following operational constraints:

1. **Account Identification & HackerOne Alias**:
   - When researching on `gitlab.com`, all test user accounts must be registered using the researcher's dedicated HackerOne email alias: `<username>@wearehackerone.com`.
2. **Strict Namespace & Tenant Isolation**:
   - Never access, view, modify, delete, or interact with data belonging to other organizations, groups, projects, or users.
   - All SaaS research must occur exclusively within private namespaces created and owned by the researcher's `@wearehackerone.com` account.
   - In local lab environments (`gitlab_research_lab`), cross-tenant interactions are simulated deterministically using isolated seed groups (`group-alpha` vs `group-beta`).
3. **Non-Destructive Test Payloads**:
   - Exploitation must be minimal and non-destructive:
     * **Remote Code Execution (RCE)**: Demonstrate code execution using benign commands (e.g., `id`, `whoami`, `uname -a`, or creating an empty file in `/tmp/security_test`). Never execute destructive commands, install persistence, extract `/etc/shadow`, or pivot through internal networks.
     * **SQL Injection (SQLi)**: Demonstrate proof using non-destructive queries (e.g., `SELECT version()`, `pg_sleep(2)`).
     * **Server-Side Request Forgery (SSRF)**: Target researcher-controlled OAST listeners (e.g., Interactsh / Burp Collaborator) or non-sensitive internal endpoints (`/api/v4/version`). Never probe cloud metadata credentials (`169.254.169.254`) to extract live production IAM secrets.
     * **Cross-Site Scripting (XSS)**: Execute harmless alerts using `alert(document.domain)` or `console.log(1)`.
4. **Traffic Throttling & Rate Limits**:
   - Limit SaaS automated requests to a maximum rate of 5 requests per second (req/sec).
   - In local research environments (`gitlab_research_lab`), testing is fully isolated and does not impact shared networks.

---

## 3. CVSS v3.1 Calculator Mapping & Bounty Tiers

GitLab utilizes a deterministic, calculator-driven methodology based on the **GitLab AppSec CVSS Calculator** (`https://gitlab-com.gitlab.io/gl-security/appsec/cvss-calculator/`) which evaluates CVSS v3.1 / v4.0 metrics paired with real-world business impact.

### 3.1 Bounty Payout Matrix

| Severity Tier | CVSS v3.1 Base Score | Payout Range (USD) | Initial Triage Payout | Representative Vulnerability Classes |
|---|---|---|---|---|
| **Critical** | **9.0 – 10.0** | **$20,000 – $35,000** | **$1,000** | Unauthenticated Remote Code Execution (RCE), Authentication Bypass, Global Data Exfiltration, Blind SSRF to Cloud Metadata with IAM Credential Theft. |
| **High** | **7.0 – 8.9** | **$5,000 – $15,000** | **$1,000** | Broken Object Level Authorization (BOLA/IDOR) to Private Repositories/Pipelines, Stored XSS in Privileged Contexts, CI/CD Runner Escape to Host. |
| **Medium** | **4.0 – 6.9** | **$1,000 – $3,000** | **$500** | Broken Function Level Authorization (BFLA), CSRF on State-Changing Endpoints, Sensitive Information Disclosure, Personal Access Token (PAT) Scope Bypass. |
| **Low** | **0.1 – 3.9** | **$100 – $750** | **$0** (Paid upon fix) | Reflected XSS requiring complex social engineering, Minor Information Leakage, Open Redirects without token harvesting. |
| **Documentation / Config** | N/A | **$100** | **$0** (Paid upon fix) | Security documentation errors or security-hardening configuration fixes in default Omnibus/GDK templates. |

### 3.2 Immediate Partial Triage Payout Bonus

GitLab implements an immediate triage bonus structure:
- **Critical & High Severity Reports**: GitLab awards an immediate **$1,000 partial bounty** upon initial validation and triage by the GitLab Application Security team, prior to engineering patch delivery.
- **Medium Severity Reports**: GitLab awards an immediate **$500 partial bounty** upon triage.
- The remaining balance of the full bounty is awarded once the vulnerability reaches the resolution and fix verification phase.

---

## 4. Responsible Disclosure Timelines & Report Standards

### 4.1 Coordinated Vulnerability Disclosure (CVD) SLA

GitLab commits to the following remediation and coordinated disclosure service-level agreements:

- **Critical Severity**: Remediation target within **30 days** of triage validation.
- **High Severity**: Remediation target within **60 days** of triage validation.
- **Medium / Low Severity**: Remediation target within **90 days** of triage validation.
- **Public Disclosure Window**: Reports are eligible for public disclosure on HackerOne **30 days** following the public release of the security patch containing the fix, or upon mutual agreement.

### 4.2 Report Reproduction & Submission Standard

To ensure rapid triage and avoid delays, all reports submitted to HackerOne must conform to the following structural standard:

1. **Title**: Structured summary following the pattern:
   `[Vulnerability Type] in [Component/API Endpoint] allows [Attacker Role] to [Specific Impact]`
2. **Target Environment**:
   - GitLab Deployment (GitLab.com SaaS or Self-Managed Community Edition / Enterprise Edition).
   - Exact Version and Commit SHA (e.g., `GitLab CE 17.3.0`, Commit `a1b2c3d4e5f67890abcdef1234567890abcdef12`).
3. **Roles & Identities Involved**:
   - Clear distinction between Attacker Role (e.g., `Reporter`, `Guest`, `External User`) and Target Resource (e.g., `Private Project in Group Alpha`).
4. **Step-by-Step Reproduction Guide**:
   - Minimal, deterministic commands using raw HTTP requests, `curl`, or GraphQL queries.
   - Exact headers (`PRIVATE-TOKEN`, `Authorization`, `Content-Type`).
5. **Non-Destructive Proof of Concept (PoC)**:
   - Verifiable, benign evidence confirming impact (e.g., status codes, response JSON, CAS SHA-256 evidence digests).
6. **DeclarativePolicy Root Cause & Remediation Analysis**:
   - Root-cause identification in GitLab codebase (e.g., missing rule in `app/policies/project_policy.rb`, omitted resolver check in `app/graphql/mutations/`, or unauthenticated Grape route in `lib/api/`).
