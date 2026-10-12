/**
 * Sentinel Sovereign Ω - Level 5 Cognitive Flow Agent
 *
 * Implements an Autonomous Cognitive Form-Solving & Workflow Navigation Engine.
 * Overcomes the fundamental limitations of blind crawlers by:
 * 1. Deep UI Context Mining: Autonomously extracts student IDs, roll numbers, user tokens,
 *    and academic/temporal context from the active session DOM, headers, and storage.
 * 2. Cascading Select Dependency Resolution: Understands and iteratively solves dependent
 *    AJAX dropdowns (e.g., Regulation -> Branch -> Semester -> Section).
 * 3. Semantic Input Synthesis: Replaces generic "test" strings with contextually valid
 *    payloads matching field semantics, regex patterns, and range constraints.
 * 4. Safe Discovery Form Submission: Triggers search/report/filter workflows to unlock deep,
 *    unlinked data tables, export endpoints, and AJAX routes without triggering destructive mutations.
 * 5. Pluggable Cognitive AI Bridge: High-speed zero-config local heuristics out-of-the-box,
 *    with an optional LLM bridge hook for complex multi-step reasoning.
 */

import { stealthCdpBrowserDriver } from './StealthCdpBrowserDriver';
import { DestructiveActionKernel, ElementInspectionData } from './DestructiveActionKernel';
import { SiteMapRequest } from '../../workspaces/ProjectScopeWorkspaceView';
import { groqService } from '../ai/GroqService';

export interface SessionContext {
  pageTitle: string;
  currentUrl?: string;
  breadcrumbs: string[];
  discoveredIdentifiers: string[];
  userTokens: {
    name?: string;
    role?: string;
    username?: string;
  };
  temporal: {
    currentYear: number;
    academicYears: string[];
    formattedToday: string;
    startOfYear: string;
  };
  keywords: string[];
}

export type SemanticFieldCategory =
  | 'IDENTIFIER'
  | 'DATE'
  | 'YEAR_SESSION'
  | 'SEMESTER'
  | 'SEARCH_QUERY'
  | 'NUMBER'
  | 'EMAIL'
  | 'USERNAME'
  | 'PASSWORD'
  | 'SELECT_DROPDOWN'
  | 'FILE_UPLOAD'
  | 'GENERAL_TEXT';

export interface CognitiveFormField {
  selector: string;
  id: string;
  name: string;
  tagName: 'input' | 'select' | 'textarea';
  type: string;
  placeholder: string;
  labelText: string;
  ariaLabel: string;
  semanticCategory: SemanticFieldCategory;
  pattern?: string;
  min?: string;
  max?: string;
  required: boolean;
  options?: Array<{ value: string; text: string }>;
  currentValue: string;
}

export interface CognitiveFormStructure {
  formId: string;
  formSelector: string;
  actionUrl: string;
  method: string;
  fields: CognitiveFormField[];
  submitTriggers: Array<{
    selector: string;
    id: string;
    text: string;
    className: string;
    type: string;
  }>;
}

export interface CognitiveExecutionReport {
  formSelector: string;
  actionUrl: string;
  fieldsFilled: Record<string, string>;
  triggerClicked: string;
  discoveredEndpoints: string[];
  newSurfacesCount: number;
  success: boolean;
  notes: string;
}

export class CognitiveFlowAgent {
  private customLlmHook: ((prompt: string) => Promise<string>) | null = null;
  private solvedFormSignatures = new Set<string>();

  /**
   * Pluggable LLM Provider Hook: Allows passing Gemini, OpenAI, Anthropic, or local Ollama
   * to assist with semantic form reasoning if configured.
   */
  public setLlmHook(hook: (prompt: string) => Promise<string>): void {
    this.customLlmHook = hook;
  }

  /**
   * Dispatches cognitive reasoning to the active LLM hook or Groq LPU engine.
   */
  public async executeLlmReasoning(prompt: string, systemPrompt?: string): Promise<string> {
    if (this.customLlmHook) {
      return this.customLlmHook(prompt);
    }
    if (groqService.isEnabled()) {
      return groqService.chatCompletion(prompt, systemPrompt);
    }
    return '';
  }

  /**
   * Resets solved form cache when starting a fresh crawl
   */
  public resetState(): void {
    this.solvedFormSignatures.clear();
  }

  /**
   * 1. Deep UI Context Mining
   * Inspects active DOM, headers, user profile cards, tables, storage, and URL
   * to harvest candidate identifiers (roll numbers, student IDs, session codes)
   * and temporal context without hardcoding.
   */
  public async extractSessionContext(): Promise<SessionContext> {
    const rawContext = await stealthCdpBrowserDriver.evaluate<any>(`
      (function() {
        const title = (document.title || '').trim();
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, .card-title, .page-title, .product-title, .product-name, [data-component-type="s-product-image"], .a-text-normal, nav a, .nav-item a, .cat-link, .category-name'))
          .map(h => (h.innerText || h.textContent || '').trim())
          .filter(Boolean);

        const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb, .breadcrumbs, [aria-label="breadcrumb"] li'))
          .map(b => (b.innerText || '').trim())
          .filter(Boolean);

        // 1. Harvest user profile tokens (e.g. from topbar user menu or badges)
        let userName = '';
        let userRole = '';
        const userElements = document.querySelectorAll('.user-name, .username, .user-panel, .profile-name, .user-menu, .nav-link span');
        for (const el of userElements) {
          const t = (el.innerText || el.textContent || '').trim();
          if (t && t.length > 2 && t.length < 40 && !t.includes('\\n') && !/^(home|dashboard|logout|menu|notification)$/i.test(t)) {
            userName = t;
            break;
          }
        }

        // 2. Deep Identifier Mining: Scrape candidate roll numbers, student IDs, registration codes
        const candidateIds = new Set();
        const fullBodyText = document.body ? document.body.innerText : '';

        // Patterns: 8 to 14 digit roll numbers (e.g. 210421104001), alphanumeric codes (e.g. RIT202401)
        const numericMatches = fullBodyText.match(/\\b(?:20\\d{8,12}|\\d{10,14})\\b/g) || [];
        numericMatches.slice(0, 10).forEach(m => candidateIds.add(m));

        const alphanumericMatches = fullBodyText.match(/\\b[A-Z]{2,5}\\d{4,10}\\b/g) || [];
        alphanumericMatches.slice(0, 10).forEach(m => candidateIds.add(m));

        // Mine localStorage & sessionStorage for IDs
        try {
          [localStorage, sessionStorage].forEach(store => {
            for (let i = 0; i < store.length; i++) {
              const k = store.key(i) || '';
              const v = store.getItem(k) || '';
              if (/id|reg|roll|user|code/i.test(k) && v.length > 2 && v.length < 50) {
                const sub = v.match(/\\b[A-Za-z0-9]{5,20}\\b/g) || [];
                sub.forEach(s => candidateIds.add(s));
              }
            }
          });
        } catch {}

        // Harvest contextual keywords from page (products, categories, topics)
        const stopWords = new Set([
          'home', 'dashboard', 'index', 'view', 'page', 'main', 'sign', 'login', 'register',
          'account', 'cart', 'order', 'help', 'privacy', 'terms', 'about', 'contact',
          'pentest', 'pentesting', 'sentinel', 'exploit', 'audit', 'test'
        ]);
        const keywords = Array.from(new Set(
          headings.concat(breadcrumbs)
            .join(' ')
            .toLowerCase()
            .split(/[^a-zA-Z0-9]+/)
            .filter(w => w.length > 3 && !stopWords.has(w))
        )).slice(0, 25);

        return {
          title,
          headings,
          breadcrumbs,
          userName,
          userRole,
          candidateIds: Array.from(candidateIds),
          keywords
        };
      })()
    `);

    const now = new Date();
    const currentYear = now.getFullYear();
    const academicYears = [
      `${currentYear - 1}-${currentYear}`,
      `${currentYear}-${currentYear + 1}`,
      `${currentYear - 2}-${currentYear - 1}`,
      String(currentYear),
      String(currentYear - 1)
    ];

    const pad = (n: number) => String(n).padStart(2, '0');
    const formattedToday = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const startOfYear = `${now.getFullYear()}-01-01`;

    return {
      pageTitle: rawContext?.title || '',
      breadcrumbs: rawContext?.breadcrumbs || [],
      discoveredIdentifiers: (rawContext?.candidateIds || []).filter((id: string) => id.length >= 4),
      userTokens: {
        name: rawContext?.userName || undefined,
        role: rawContext?.userRole || undefined,
      },
      temporal: {
        currentYear,
        academicYears,
        formattedToday,
        startOfYear
      },
      keywords: rawContext?.keywords || []
    };
  }

  /**
   * 2. Inspects and Extracts Form Structures on the Page
   * Discovers explicit <form> tags as well as dynamic query/filter card containers.
   */
  public async inspectPageForms(): Promise<CognitiveFormStructure[]> {
    const rawForms = await stealthCdpBrowserDriver.evaluate<any[]>(`
      (function() {
        const results = [];
        const seenContainers = new Set();

        // Target both standard forms and modern SPA filter containers (cards, fieldsets, toolbars)
        const containers = Array.from(document.querySelectorAll('form, .filter-box, .search-box, .report-filter, [role="search"], .card-body:has(select), .card-body:has(input)'));

        for (let i = 0; i < containers.length; i++) {
          const c = containers[i];
          if (seenContainers.has(c)) continue;
          seenContainers.add(c);

          const formId = c.id || ('auto_form_' + i);
          const formSelector = c.id ? '#' + c.id : (c.tagName.toLowerCase() + (c.className ? '.' + c.className.trim().split(/\\s+/)[0] : ''));
          const actionUrl = c.getAttribute('action') || window.location.href;
          const method = (c.getAttribute('method') || 'GET').toUpperCase();

          // Collect form fields
          const fieldNodes = Array.from(c.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'));
          if (fieldNodes.length === 0) continue;

          const fields = [];
          for (const node of fieldNodes) {
            const tagName = node.tagName.toLowerCase();
            const id = node.id || '';
            const name = node.getAttribute('name') || id || '';
            const type = (node.getAttribute('type') || (tagName === 'select' ? 'select' : 'text')).toLowerCase();
            const placeholder = node.getAttribute('placeholder') || '';
            const ariaLabel = node.getAttribute('aria-label') || '';
            const pattern = node.getAttribute('pattern') || undefined;
            const min = node.getAttribute('min') || undefined;
            const max = node.getAttribute('max') || undefined;
            const required = node.hasAttribute('required') || false;
            const currentValue = node.value || '';

            // Find associated label text
            let labelText = '';
            if (id) {
              const lbl = document.querySelector('label[for="' + id + '"]');
              if (lbl) labelText = (lbl.innerText || '').trim();
            }
            if (!labelText && node.closest('label')) {
              labelText = (node.closest('label').innerText || '').trim();
            }
            if (!labelText && node.parentElement) {
              const prev = node.previousElementSibling;
              if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN')) {
                labelText = (prev.innerText || '').trim();
              }
            }

            // Extract options for selects
            let options = undefined;
            if (tagName === 'select') {
              options = Array.from(node.options || []).map(o => ({
                value: o.value || '',
                text: (o.text || o.innerText || '').trim()
              }));
            }

            // Classify semantic category
            const descriptor = (name + ' ' + id + ' ' + labelText + ' ' + placeholder + ' ' + ariaLabel).toLowerCase();
            let semanticCategory = 'GENERAL_TEXT';

            if (tagName === 'select') {
              semanticCategory = 'SELECT_DROPDOWN';
            } else if (type === 'file') {
              semanticCategory = 'FILE_UPLOAD';
            } else if (type === 'date' || /\\b(dob|birth|exam_date|from_date|to_date|start_date|end_date|date)\\b/.test(descriptor)) {
              semanticCategory = 'DATE';
            } else if (/\\b(reg|roll|student_id|admission|enroll|emp_id|staff_id|regno|rollno|candidate_id)\\b/.test(descriptor)) {
              semanticCategory = 'IDENTIFIER';
            } else if (/\\b(year|session|batch|regulation)\\b/.test(descriptor)) {
              semanticCategory = 'YEAR_SESSION';
            } else if (/\\b(sem|semester|term)\\b/.test(descriptor)) {
              semanticCategory = 'SEMESTER';
            } else if (type === 'search' || /\\b(search|query|filter|keyword|q)\\b/.test(descriptor)) {
              semanticCategory = 'SEARCH_QUERY';
            } else if (type === 'password' || /\\b(password|passwd|pwd)\\b/.test(descriptor)) {
              semanticCategory = 'PASSWORD';
            } else if (type === 'email' || /\\bemail\\b/.test(descriptor)) {
              semanticCategory = 'EMAIL';
            } else if (/\\b(username|user_id|login_id|account|user)\\b/.test(descriptor)) {
              semanticCategory = 'USERNAME';
            } else if (type === 'number' || /\\b(marks|count|limit|amount|quantity)\\b/.test(descriptor)) {
              semanticCategory = 'NUMBER';
            }

            const fieldSelector = id ? '#' + id : (name ? '[name="' + name + '"]' : tagName);

            fields.push({
              selector: fieldSelector,
              id,
              name,
              tagName,
              type,
              placeholder,
              labelText,
              ariaLabel,
              semanticCategory,
              pattern,
              min,
              max,
              required,
              options,
              currentValue
            });
          }

          // Discover candidate submit triggers inside or near the container
          const buttonNodes = Array.from(c.querySelectorAll('button, input[type="submit"], input[type="button"], .btn'));
          const submitTriggers = [];

          for (const btn of buttonNodes) {
            const btnText = (btn.innerText || btn.value || '').trim();
            const btnId = btn.id || '';
            const btnClass = btn.className || '';
            const btnType = btn.getAttribute('type') || 'button';
            const btnSel = btnId ? '#' + btnId : (btnText ? 'button' : 'input[type="submit"]');

            submitTriggers.push({
              selector: btnSel,
              id: btnId,
              text: btnText,
              className: btnClass,
              type: btnType
            });
          }

          results.push({
            formId,
            formSelector,
            actionUrl,
            method,
            fields,
            submitTriggers
          });
        }

        return results;
      })()
    `);

    return rawForms || [];
  }

  /**
   * 3. Semantic Input Value Synthesizer
   * Produces an authentic, contextually valid payload matching field constraints.
   */
  public synthesizeFieldValue(field: CognitiveFormField, context: SessionContext): string {
    switch (field.semanticCategory) {
      case 'IDENTIFIER': {
        // Priority 1: Use an identifier already active in this user's session
        if (context.discoveredIdentifiers.length > 0) {
          // If regex pattern exists, pick the identifier matching the pattern
          if (field.pattern) {
            try {
              const rx = new RegExp(field.pattern);
              const match = context.discoveredIdentifiers.find(id => rx.test(id));
              if (match) return match;
            } catch {}
          }
          return context.discoveredIdentifiers[0];
        }

        // Priority 2: Infer from placeholder example (e.g., "e.g. 210421104001")
        if (field.placeholder) {
          const numMatch = field.placeholder.match(/\\b\\d{8,14}\\b/);
          if (numMatch) return numMatch[0];
        }

        // Priority 3: Synthesize from pattern or standard graduation roll format
        if (field.pattern && field.pattern.includes('12')) {
          return `${context.temporal.currentYear - 2}040001001`;
        }
        return '1001';
      }

      case 'YEAR_SESSION': {
        return context.temporal.academicYears[0] || String(context.temporal.currentYear);
      }

      case 'SEMESTER': {
        return '5';
      }

      case 'DATE': {
        // Return valid YYYY-MM-DD or format matching min/max
        if (field.name.toLowerCase().includes('from') || field.name.toLowerCase().includes('start')) {
          return context.temporal.startOfYear;
        }
        return context.temporal.formattedToday;
      }

      case 'SEARCH_QUERY': {
        // Return contextual keyword mined from active page or wildcard
        if (context.keywords.length > 0) {
          return context.keywords[0];
        }
        return '%';
      }

      case 'NUMBER': {
        if (field.min) return field.min;
        return '1';
      }

      case 'PASSWORD': {
        return 'password';
      }

      case 'USERNAME': {
        return context.userTokens.username || 'admin@example.com';
      }

      case 'EMAIL': {
        return 'admin@example.com';
      }

      case 'FILE_UPLOAD': {
        return '[Synthesized File Payload]';
      }

      case 'GENERAL_TEXT':
      default: {
        if (field.placeholder && field.placeholder.length > 2 && field.placeholder.length < 20) {
          return field.placeholder;
        }
        return context.keywords[0] || '1';
      }
    }
  }

  /**
   * 4. Cascading Select Dependency Resolver
   * Iterates through <select> elements in top-to-bottom DOM order.
   * Dispatches change & input events on each select and awaits dependent AJAX updates.
   */
  public async resolveCascadingSelects(
    form: CognitiveFormStructure,
    reportProgress?: (msg: string) => void
  ): Promise<number> {
    const selectFields = form.fields.filter(f => f.tagName === 'select');
    if (selectFields.length === 0) return 0;

    let solvedCount = 0;

    for (let i = 0; i < selectFields.length; i++) {
      const field = selectFields[i];

      // Re-read current options from live DOM (to capture options populated by prior AJAX calls)
      const currentOptions = await stealthCdpBrowserDriver.evaluate<Array<{ value: string; text: string }>>(`
        (function() {
          const el = document.querySelector(${JSON.stringify(field.selector)}) ||
                     document.getElementById(${JSON.stringify(field.id)}) ||
                     document.querySelector('select[name="' + ${JSON.stringify(field.name)} + '"]');
          if (!el || el.tagName !== 'SELECT') return [];
          return Array.from(el.options || []).map(o => ({
            value: o.value || '',
            text: (o.text || o.innerText || '').trim()
          }));
        })()
      `);

      if (!currentOptions || currentOptions.length === 0) continue;

      // Filter out empty placeholder options ("Select...", "-- Choose --", "", "0", "-1")
      const validOptions = currentOptions.filter(o => {
        const val = (o.value || '').trim();
        const txt = (o.text || '').toLowerCase().trim();
        if (!val || val === '0' || val === '-1') return false;
        if (txt.startsWith('select') || txt.startsWith('--') || txt.startsWith('choose')) return false;
        return true;
      });

      if (validOptions.length === 0) continue;

      // Pick the first valid option
      const chosenOption = validOptions[0];
      if (reportProgress) {
        reportProgress(`Cognitive Flow: Selecting [${field.labelText || field.name}] -> "${chosenOption.text || chosenOption.value}"`);
      }

      await stealthCdpBrowserDriver.selectOption(
        { selector: field.selector, idMatch: field.id, nameMatch: field.name, adaptive: true },
        chosenOption.value
      );

      solvedCount++;

      // Wait 350ms for reactive AJAX cascades to update subsequent dropdowns
      await stealthCdpBrowserDriver.waitForDomSettle(350);
    }

    return solvedCount;
  }

  /**
   * 5. Autonomous Multi-Step Form Workflow Execution
   * Fills form inputs with synthesized contextual values, activates cascades,
   * clicks the safe submit/query button, and harvests newly exposed data tables and endpoints.
   */
  public async executeFormWorkflow(
    form: CognitiveFormStructure,
    context: SessionContext,
    reportProgress?: (msg: string) => void
  ): Promise<CognitiveExecutionReport> {
    const report: CognitiveExecutionReport = {
      formSelector: form.formSelector,
      actionUrl: form.actionUrl,
      fieldsFilled: {},
      triggerClicked: '',
      discoveredEndpoints: [],
      newSurfacesCount: 0,
      success: false,
      notes: ''
    };

    const signature = `${form.formSelector}:${form.fields.map(f => f.name).join(',')}`;
    if (this.solvedFormSignatures.has(signature)) {
      report.notes = 'Form signature already explored in this crawl session';
      return report;
    }
    this.solvedFormSignatures.add(signature);

    if (reportProgress) {
      reportProgress(`Cognitive Flow: Solving form "${form.formId}" (${form.fields.length} fields)...`);
    }

    // 1. Solve cascading selects first
    await this.resolveCascadingSelects(form, reportProgress);

    // 2. Query Groq LPU AI inference for semantic form resolution if enabled
    let groqValues: Record<string, string> | null = null;
    if (groqService.isEnabled()) {
      try {
        if (reportProgress) {
          reportProgress(`Cognitive Flow: Inferring form semantics via Groq AI (${groqService.getModel()})...`);
        }
        groqValues = await groqService.resolveFormFields(form, context);
        if (groqValues && Object.keys(groqValues).length > 0 && reportProgress) {
          reportProgress(`Cognitive Flow: Groq AI synthesized ${Object.keys(groqValues).length} fields`);
        }
      } catch (err) {
        console.warn('Groq form resolution failed, falling back to heuristics:', err);
      }
    }

    // 3. Fill text / date / identifier / file inputs
    const inputFields = form.fields.filter(f => f.tagName !== 'select');
    for (const field of inputFields) {
      // Check if this is a file upload input
      if (field.type === 'file' || field.semanticCategory === 'FILE_UPLOAD') {
        if (reportProgress) {
          reportProgress(`Cognitive Flow: Synthesizing file upload for [${field.labelText || field.name || field.id}]`);
        }
        await stealthCdpBrowserDriver.synthesizeAndAttachFileInput({
          selector: field.selector,
          idMatch: field.id,
          nameMatch: field.name
        });
        report.fieldsFilled[field.name || field.id] = '[Synthetic File Upload]';
        continue;
      }

      // Skip if already filled with a valid value
      if (field.currentValue && field.currentValue.length > 2) {
        report.fieldsFilled[field.name || field.id] = field.currentValue;
        continue;
      }

      // Check Groq synthesized value first, fallback to deterministic heuristics
      const keyName = field.name || field.id;
      let val = groqValues && (groqValues[keyName] || (field.id && groqValues[field.id]) || (field.name && groqValues[field.name]));
      if (!val) {
        val = this.synthesizeFieldValue(field, context);
      }

      if (val) {
        if (reportProgress) {
          reportProgress(`Cognitive Flow: Input [${field.labelText || field.name}] <= "${val}"`);
        }
        await stealthCdpBrowserDriver.fillInput(
          {
            selector: field.selector,
            idMatch: field.id,
            textMatch: field.name,
            nameMatch: field.name,
            placeholderMatch: field.placeholder,
            ariaMatch: field.ariaLabel,
            adaptive: true
          },
          val
        );
        report.fieldsFilled[field.name || field.id] = val;
      }
    }

    // 3. Select the best safe action trigger
    const safeTriggers = form.submitTriggers.filter(t => {
      const data: ElementInspectionData = {
        id: t.id,
        className: t.className,
        text: t.text,
        type: t.type
      };
      return DestructiveActionKernel.isSafeElement(data);
    });

    if (safeTriggers.length === 0) {
      report.notes = 'No safe submission trigger found in form container';
      return report;
    }

    // Prioritize search / view / get / report / login buttons
    const primaryTrigger =
      safeTriggers.find(t => /^(view|search|get|generate|fetch|filter|show|display|find|go|submit|preview|login|sign\s*in|log\s*in)/i.test(t.text.trim())) ||
      safeTriggers[0];

    report.triggerClicked = primaryTrigger.text || primaryTrigger.id || 'submit';

    if (reportProgress) {
      reportProgress(`Cognitive Flow: Clicking trigger "${report.triggerClicked}" to unlock dynamic surfaces...`);
    }

    // 4. Click the trigger
    const clicked = await stealthCdpBrowserDriver.clickElement({
      selector: primaryTrigger.selector,
      idMatch: primaryTrigger.id,
      textMatch: primaryTrigger.text,
      adaptive: true
    });

    if (!clicked) {
      report.notes = 'Trigger click did not dispatch';
      return report;
    }

    // 5. Await DOM settle and AJAX response
    await stealthCdpBrowserDriver.waitForDomSettle(800);

    // 6. Harvest newly exposed surfaces (tables, downloads, report endpoints, modals)
    const newlyExposed = await stealthCdpBrowserDriver.evaluate<Array<{ url: string; text: string; source: string }>>(`
      (function() {
        const found = [];
        const seen = new Set();

        // 1. Newly exposed table links and action buttons
        document.querySelectorAll('table a[href], .table a[href], a[href*="download"], a[href*="export"], a[href*="pdf"], a[href*="print"]').forEach(a => {
          const href = a.getAttribute('href') || '';
          if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !seen.has(href)) {
            seen.add(href);
            found.push({ url: href, text: (a.innerText || '').trim(), source: 'Cognitive-ReportTable' });
          }
        });

        // 2. Data attributes on newly rendered elements
        document.querySelectorAll('[data-url], [data-href], [data-endpoint], [data-report]').forEach(el => {
          const u = el.getAttribute('data-url') || el.getAttribute('data-href') || el.getAttribute('data-endpoint') || el.getAttribute('data-report') || '';
          if (u && !seen.has(u)) {
            seen.add(u);
            found.push({ url: u, text: (el.innerText || '').trim(), source: 'Cognitive-DataEndpoint' });
          }
        });

        return found;
      })()
    `);

    if (newlyExposed && newlyExposed.length > 0) {
      report.newSurfacesCount = newlyExposed.length;
      report.discoveredEndpoints = newlyExposed.map(e => e.url);
      report.success = true;
      if (reportProgress) {
        reportProgress(`Cognitive Flow: Unlocked ${newlyExposed.length} dynamic endpoints via form workflow!`);
      }
    } else {
      report.success = true;
      report.notes = 'Form submitted; state settled cleanly';
    }

    return report;
  }

  /**
   * 6. High-Level Entry Point for StateFlowGraphCrawler
   * Discovers and executes all cognitive forms on the current live page state.
   */
  public async discoverAndSolveAllForms(
    targetHost: string,
    currentUrl: string,
    onItemDiscovered?: (item: SiteMapRequest) => void,
    reportProgress?: (msg: string) => void
  ): Promise<CognitiveExecutionReport[]> {
    const results: CognitiveExecutionReport[] = [];

    try {
      // 1. Mine active UI session context
      const context = await this.extractSessionContext();

      // 2. Inspect forms on the active page
      const forms = await this.inspectPageForms();
      if (forms.length === 0) return results;

      if (reportProgress) {
        reportProgress(`Cognitive Flow: Found ${forms.length} interactive form workflows on ${currentUrl}`);
      }

      // 3. Solve each form safely
      for (const form of forms) {
        const rep = await this.executeFormWorkflow(form, context, reportProgress);
        results.push(rep);

        // Register any discovered endpoints into the Site Map
        if (rep.discoveredEndpoints && rep.discoveredEndpoints.length > 0 && onItemDiscovered) {
          for (const ep of rep.discoveredEndpoints) {
            let fullUrl = ep;
            try {
              fullUrl = new URL(ep, currentUrl).href;
            } catch {}

            const path = fullUrl.startsWith('http') ? new URL(fullUrl).pathname + new URL(fullUrl).search : ep;

            onItemDiscovered({
              id: 'cog_' + Math.random().toString(36).slice(2, 10),
              method: 'GET',
              host: targetHost,
              path,
              url: fullUrl,
              status: 200,
              length: 0,
              mime: ep.includes('.pdf') ? 'application/pdf' : 'application/json',
              title: `Cognitive Surface: ${rep.triggerClicked}`,
              notes: 'Discovered via Cognitive Flow Agent',
              requestRaw: `GET ${path} HTTP/1.1\r\nHost: ${targetHost}\r\n`,
              responseRaw: `HTTP/1.1 200 OK\r\n\r\n`,
              reqAttributes: { Method: 'GET', Path: path, Source: 'CognitiveFlow' },
              reqHeaders: { Host: targetHost },
              resAttributes: { Status: '200 OK', Source: 'Cognitive Flow Form' },
              resHeaders: {},
              params: ep.includes('?'),
              isDiscovered: true,
            });
          }
        }
      }
    } catch (err) {
      console.warn('CognitiveFlowAgent error during form resolution:', err);
    }

    return results;
  }
}

export const cognitiveFlowAgent = new CognitiveFlowAgent();
