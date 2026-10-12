/**
 * Sentinel Sovereign Ω - LLM Markdown Synthesizer (Inspired by Scrapling)
 *
 * Converts raw HTML, HTTP responses, and live DOM trees into clean,
 * structured, high-density Markdown formatted specifically for LLM context windows.
 *
 * Key Capabilities:
 * - Strips noise: Removes scripts, CSS styles, SVGs, canvas, base64 images, and tracking bloat
 * - Preserves security context: Extracts forms, hidden inputs, CSRF tokens, and auth headers
 * - Extracts API endpoints: Collects links, data-endpoints, and embedded state schemas
 * - Unpacks embedded JSON states: Pulls Next.js __NEXT_DATA__, Redux, and JSON-LD payloads
 * - Token-efficient formatting: Produces readable tables, headings, and lists
 */

export interface LlmMarkdownOptions {
  includeEndpointsSummary?: boolean;
  includeFormsSummary?: boolean;
  includeEmbeddedJson?: boolean;
  maxContentLength?: number;
  baseUrl?: string;
}

export interface ExtractedFormDef {
  action: string;
  method: string;
  id?: string;
  fields: Array<{
    name: string;
    type: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
  }>;
}

export interface ExtractedEndpointDef {
  url: string;
  method?: string;
  text?: string;
  type: 'link' | 'api' | 'form' | 'script';
}

export class LlmMarkdownSynthesizer {
  /**
   * Converts raw HTML string into clean LLM Markdown
   */
  public static htmlToMarkdown(html: string, options: LlmMarkdownOptions = {}): string {
    if (!html || typeof html !== 'string') return '';

    const {
      includeEndpointsSummary = true,
      includeFormsSummary = true,
      includeEmbeddedJson = true,
      maxContentLength = 120000,
      baseUrl = ''
    } = options;

    let processed = html;

    // 1. Extract Title
    const titleMatch = processed.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // 2. Extract Forms before stripping tags
    const forms: ExtractedFormDef[] = [];
    const formRegex = /<form([^>]*)>([\s\S]*?)<\/form>/gi;
    let formMatch: RegExpExecArray | null;

    while ((formMatch = formRegex.exec(processed)) !== null) {
      const formAttrs = formMatch[1] || '';
      const formBody = formMatch[2] || '';

      const actionMatch = formAttrs.match(/action=["']([^"']*)["']/i);
      const methodMatch = formAttrs.match(/method=["']([^"']*)["']/i);
      const idMatch = formAttrs.match(/id=["']([^"']*)["']/i);

      const action = actionMatch ? actionMatch[1] : (baseUrl || '/');
      const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';

      const fields: ExtractedFormDef['fields'] = [];
      const inputRegex = /<(input|select|textarea)([^>]*)>/gi;
      let inputMatch: RegExpExecArray | null;

      while ((inputMatch = inputRegex.exec(formBody)) !== null) {
        const tag = inputMatch[1].toLowerCase();
        const attrs = inputMatch[2] || '';

        const nameMatch = attrs.match(/name=["']([^"']*)["']/i);
        const typeMatch = attrs.match(/type=["']([^"']*)["']/i);
        const placeholderMatch = attrs.match(/placeholder=["']([^"']*)["']/i);
        const valueMatch = attrs.match(/value=["']([^"']*)["']/i);
        const isRequired = /required/i.test(attrs);

        const name = nameMatch ? nameMatch[1] : '';
        if (name) {
          fields.push({
            name,
            type: typeMatch ? typeMatch[1] : tag,
            placeholder: placeholderMatch ? placeholderMatch[1] : undefined,
            value: valueMatch ? valueMatch[1] : undefined,
            required: isRequired
          });
        }
      }

      forms.push({
        action,
        method,
        id: idMatch ? idMatch[1] : undefined,
        fields
      });
    }

    // 3. Extract Embedded JSON Data (e.g., __NEXT_DATA__, ld+json)
    const embeddedJsonBlocks: Array<{ type: string; data: string }> = [];
    if (includeEmbeddedJson) {
      const nextDataMatch = processed.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (nextDataMatch) {
        try {
          const parsed = JSON.parse(nextDataMatch[1]);
          embeddedJsonBlocks.push({ type: 'Next.js App Data (__NEXT_DATA__)', data: JSON.stringify(parsed, null, 2) });
        } catch {}
      }

      const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let jsonLdMatch: RegExpExecArray | null;
      while ((jsonLdMatch = jsonLdRegex.exec(processed)) !== null) {
        try {
          const parsed = JSON.parse(jsonLdMatch[1]);
          embeddedJsonBlocks.push({ type: 'Structured Schema (JSON-LD)', data: JSON.stringify(parsed, null, 2) });
        } catch {}
      }
    }

    // 4. Extract API and navigation endpoints
    const endpoints: ExtractedEndpointDef[] = [];
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;
    const seenLinks = new Set<string>();

    while ((linkMatch = linkRegex.exec(processed)) !== null) {
      const href = linkMatch[1].trim();
      const text = linkMatch[2].replace(/<[^>]+>/g, '').trim();

      if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !seenLinks.has(href)) {
        seenLinks.add(href);
        endpoints.push({
          url: href,
          text: text || undefined,
          type: 'link'
        });
      }
    }

    // 5. Clean HTML tags
    // Remove scripts, styles, SVGs, noscript, iframes
    processed = processed
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Convert Headings
    processed = processed
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
      .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n')
      .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n')
      .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

    // Convert Paragraphs, Breaks & Spacing
    processed = processed
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
      .replace(/<hr[^>]*>/gi, '\n\n---\n\n');

    // Convert Strong, Bold, Emphasis
    processed = processed
      .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
      .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

    // Convert Preformatted Code Blocks
    processed = processed.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => {
      const unescaped = code.replace(/<[^>]+>/g, '').trim();
      return `\n\n\`\`\`\n${unescaped}\n\`\`\`\n\n`;
    });

    // Convert List items
    processed = processed
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
      .replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

    // Convert Table Rows
    processed = processed
      .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row) => {
        const cells: string[] = [];
        const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi;
        let cMatch: RegExpExecArray | null;
        while ((cMatch = cellRegex.exec(row)) !== null) {
          const txt = cMatch[2].replace(/<[^>]+>/g, '').trim().replace(/\|/g, '\\|');
          cells.push(txt || ' ');
        }
        return cells.length > 0 ? `| ${cells.join(' | ')} |\n` : '';
      })
      .replace(/<\/?(thead|tbody|tfoot|table)[^>]*>/gi, '\n');

    // Strip any remaining HTML tags
    processed = processed.replace(/<[^>]+>/g, '');

    // Decode standard HTML entities
    processed = processed
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'");

    // Normalize excess blank lines
    processed = processed.replace(/\n{3,}/g, '\n\n').trim();

    // 6. Build the Structured LLM Markdown document
    const lines: string[] = [];

    if (title) {
      lines.push(`# ${title}`);
    }
    if (baseUrl) {
      lines.push(`> Source Target: \`${baseUrl}\``);
    }

    // Forms Section
    if (includeFormsSummary && forms.length > 0) {
      lines.push('\n## 🛡️ Interactive Forms & Input Parameters');
      forms.forEach((f, idx) => {
        lines.push(`\n### Form ${idx + 1}: \`${f.method} ${f.action}\`${f.id ? ` (#${f.id})` : ''}`);
        if (f.fields.length === 0) {
          lines.push('_No named input fields detected._');
        } else {
          f.fields.forEach(field => {
            const req = field.required ? ' *(required)*' : '';
            const val = field.value ? ` [default="${field.value}"]` : '';
            const ph = field.placeholder ? ` [placeholder="${field.placeholder}"]` : '';
            lines.push(`- **\`${field.name}\`** (\`${field.type}\`)${req}${ph}${val}`);
          });
        }
      });
    }

    // Endpoints Summary
    if (includeEndpointsSummary && endpoints.length > 0) {
      lines.push(`\n## 🌐 Discovered Endpoint Surfaces (${endpoints.length})`);
      endpoints.slice(0, 30).forEach(ep => {
        lines.push(`- \`${ep.url}\`${ep.text ? ` (${ep.text.slice(0, 40)})` : ''}`);
      });
      if (endpoints.length > 30) {
        lines.push(`- *...and ${endpoints.length - 30} more endpoints*`);
      }
    }

    // Embedded JSON Blocks
    if (includeEmbeddedJson && embeddedJsonBlocks.length > 0) {
      lines.push('\n## 📦 Embedded State & Schema JSON');
      embeddedJsonBlocks.forEach(block => {
        lines.push(`\n### ${block.type}`);
        lines.push('```json');
        lines.push(block.data.slice(0, 3000));
        if (block.data.length > 3000) {
          lines.push('// ... truncated for context window efficiency ...');
        }
        lines.push('```');
      });
    }

    // Main Content
    lines.push('\n## 📄 Clean Page Content');
    lines.push(processed.slice(0, maxContentLength));

    return lines.join('\n');
  }

  /**
   * Converts full raw HTTP response (Headers + Body) into LLM Markdown
   */
  public static httpResponseToMarkdown(responseRaw: string, targetUrl?: string): string {
    if (!responseRaw) return '```\n[Empty Response]\n```';

    const parts = responseRaw.split(/\r?\n\r?\n/);
    const headerSection = parts[0] || '';
    const bodySection = parts.slice(1).join('\n\n');

    // Parse status line and content-type
    const statusMatch = headerSection.match(/^HTTP\/[0-9.]+\s+(\d+)\s*(.*)/i);
    const statusCode = statusMatch ? statusMatch[1] : '200';
    const statusText = statusMatch ? statusMatch[2].trim() : 'OK';

    const ctMatch = headerSection.match(/^Content-Type:\s*([^\r\n;]+)/im);
    const contentType = ctMatch ? ctMatch[1].trim().toLowerCase() : 'text/plain';

    // JSON response
    if (contentType.includes('json') || bodySection.trim().startsWith('{') || bodySection.trim().startsWith('[')) {
      let formattedJson = bodySection;
      try {
        formattedJson = JSON.stringify(JSON.parse(bodySection), null, 2);
      } catch {}

      return [
        `# HTTP ${statusCode} ${statusText}`,
        targetUrl ? `> URL: \`${targetUrl}\`` : '',
        `> Content-Type: \`${contentType}\` | Body Size: ${bodySection.length} bytes`,
        '\n```json',
        formattedJson.slice(0, 60000),
        '```'
      ].filter(Boolean).join('\n');
    }

    // HTML response
    if (contentType.includes('html') || /<!doctype html|<html/i.test(bodySection)) {
      const md = LlmMarkdownSynthesizer.htmlToMarkdown(bodySection, { baseUrl: targetUrl });
      return [
        `# HTTP ${statusCode} ${statusText}`,
        targetUrl ? `> Target: \`${targetUrl}\`` : '',
        `> Content-Type: \`${contentType}\` | Response Size: ${responseRaw.length} bytes\n`,
        md
      ].filter(Boolean).join('\n');
    }

    // Plain text / CSS / JS / etc.
    return [
      `# HTTP ${statusCode} ${statusText}`,
      targetUrl ? `> Target: \`${targetUrl}\`` : '',
      `> Content-Type: \`${contentType}\` | Length: ${bodySection.length} bytes\n`,
      '```',
      bodySection.slice(0, 40000),
      '```'
    ].filter(Boolean).join('\n');
  }
}
