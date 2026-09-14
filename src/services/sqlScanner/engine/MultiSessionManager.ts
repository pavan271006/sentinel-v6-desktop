/**
 * Sentinel Multi-Session & Multi-Persona Context Engine
 *
 * Solves RBAC and multi-tenant authorization boundary testing by:
 * 1. Maintaining isolated session containers (e.g. "admin", "standard_user", "tenant_a", "unauthenticated").
 * 2. Storing distinct cookie jars, Bearer tokens, CSRF tokens, and custom headers per persona.
 * 3. Enabling cross-persona comparative probing for automated BOLA/IDOR detection.
 */

export interface SessionPersona {
  name: string;
  role: 'admin' | 'standard_user' | 'readonly' | 'tenant_member' | 'unauthenticated';
  tenantId?: string;
  cookies: string;
  headers: Record<string, string>;
  authToken?: string;
}

export class MultiSessionManager {
  private personas: Map<string, SessionPersona> = new Map();
  private activePersonaName: string = 'default';

  constructor() {
    this.registerPersona({
      name: 'default',
      role: 'standard_user',
      cookies: '',
      headers: {},
    });
  }

  public registerPersona(persona: SessionPersona): void {
    this.personas.set(persona.name, { ...persona });
  }

  public getPersona(name: string): SessionPersona | undefined {
    return this.personas.get(name);
  }

  public setActivePersona(name: string): boolean {
    if (this.personas.has(name)) {
      this.activePersonaName = name;
      return true;
    }
    return false;
  }

  public getActivePersona(): SessionPersona {
    return this.personas.get(this.activePersonaName) || {
      name: 'default',
      role: 'standard_user',
      cookies: '',
      headers: {},
    };
  }

  public listPersonas(): SessionPersona[] {
    return Array.from(this.personas.values());
  }

  public composeHeadersForPersona(personaName: string, baseHeaders: Record<string, string> = {}): Record<string, string> {
    const persona = this.personas.get(personaName) || this.getActivePersona();
    const result: Record<string, string> = { ...baseHeaders, ...persona.headers };

    if (persona.cookies) {
      result['Cookie'] = persona.cookies;
    }

    if (persona.authToken) {
      result['Authorization'] = persona.authToken.startsWith('Bearer ') ? persona.authToken : `Bearer ${persona.authToken}`;
    }

    if (persona.tenantId) {
      result['X-Tenant-Id'] = persona.tenantId;
    }

    return result;
  }
}
