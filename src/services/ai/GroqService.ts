/**
 * Sentinel Sovereign Ω - Groq Cognitive AI Engine
 *
 * Provides ultra-fast (sub-200ms) LLM inference via Groq LPUs.
 * Powers the crawler's CognitiveFlowAgent for semantic form reasoning,
 * multi-step wizard solving, and context-aware input synthesis.
 */

import { CognitiveFormField, CognitiveFormStructure, SessionContext } from '../contentDiscovery/CognitiveFlowAgent';

export interface GroqConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
  temperature: number;
}

export class GroqService {
  private static readonly STORAGE_KEY = 'sentinel_groq_api_key';
  private static readonly STORAGE_MODEL_KEY = 'sentinel_groq_model';
  private static readonly STORAGE_ENABLED_KEY = 'sentinel_groq_enabled';
  private static readonly DEFAULT_KEY = '';
  private static readonly DEFAULT_MODEL = 'qwen/qwen3.8-27b';

  private apiKey: string;
  private model: string;
  private enabled: boolean;

  constructor() {
    this.apiKey = typeof window !== 'undefined'
      ? localStorage.getItem(GroqService.STORAGE_KEY) || GroqService.DEFAULT_KEY
      : GroqService.DEFAULT_KEY;

    this.model = typeof window !== 'undefined'
      ? localStorage.getItem(GroqService.STORAGE_MODEL_KEY) || GroqService.DEFAULT_MODEL
      : GroqService.DEFAULT_MODEL;

    this.enabled = typeof window !== 'undefined'
      ? localStorage.getItem(GroqService.STORAGE_ENABLED_KEY) !== 'false'
      : true;
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(GroqService.STORAGE_KEY, this.apiKey);
    }
  }

  public getModel(): string {
    return this.model;
  }

  public setModel(model: string): void {
    this.model = model.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(GroqService.STORAGE_MODEL_KEY, this.model);
    }
  }

  public isEnabled(): boolean {
    return this.enabled && Boolean(this.apiKey && this.apiKey.startsWith('gsk_'));
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(GroqService.STORAGE_ENABLED_KEY, enabled ? 'true' : 'false');
    }
  }

  /**
   * Resolves complex web form fields into safe discovery values using Groq LPU inference.
   * Returns a map of fieldName -> synthesizedValue or null if unavailable.
   */
  public async resolveFormFields(
    form: CognitiveFormStructure,
    context: SessionContext
  ): Promise<Record<string, string> | null> {
    if (!this.isEnabled()) return null;

    try {
      const fieldSummaries = form.fields.map((f: CognitiveFormField) => ({
        name: f.name || f.id,
        tagName: f.tagName,
        type: f.type,
        labelText: f.labelText,
        placeholder: f.placeholder,
        semanticCategory: f.semanticCategory,
        pattern: f.pattern,
        min: f.min,
        max: f.max,
        optionsCount: f.options?.length || 0,
      }));

      const systemPrompt = `You are an autonomous web crawler cognitive agent for web application mapping.
Analyze the target form structure and context, and output a valid JSON object mapping each field name to an optimal, contextually valid, safe discovery test value.
Rules:
1. Return ONLY a single JSON object where keys are the field names and values are strings or numbers to input.
2. For search queries, use common exploratory keywords matching page context.
3. For identifiers/roll numbers/codes, match patterns or format requirements.
4. For date fields, use valid ISO dates (e.g. YYYY-MM-DD).
5. Never output harmful or injection payloads; use benign exploratory discovery values only.`;

      const userPrompt = `Page Context:
- Title: ${context.pageTitle}
- URL: ${context.currentUrl}
- Discovered Identifiers in session: ${JSON.stringify(context.discoveredIdentifiers)}
- Keywords: ${JSON.stringify(context.keywords)}

Form ID: "${form.formId}" (Action: "${form.actionUrl}")
Fields to fill:
${JSON.stringify(fieldSummaries, null, 2)}`;

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 600,
        }),
        signal: AbortSignal.timeout(4000), // Fast 4-second timeout to prevent crawler stalls
      });

      if (!res.ok) {
        console.warn(`[GroqService] Form resolution API status: ${res.status}`);
        return null;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v !== null && v !== undefined) {
          result[k] = String(v);
        }
      }

      return Object.keys(result).length > 0 ? result : null;
    } catch (err) {
      console.warn('[GroqService] Failed to resolve form via Groq:', err);
      return null;
    }
  }

  /**
   * General-purpose chat completion hook for cognitive reasoning.
   */
  public async chatCompletion(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.isEnabled()) return '';

    try {
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.2,
          max_tokens: 1000,
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) return '';
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch {
      return '';
    }
  }
}

export const groqService = new GroqService();
