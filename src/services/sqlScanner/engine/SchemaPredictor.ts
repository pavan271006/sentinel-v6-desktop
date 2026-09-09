/**
 * SOHE God Rail v3 — Framework & ORM Schema Predictor
 *
 * Provides instant, zero-bruteforce schema prioritization.
 *
 * Instead of relying on slow dictionary wordlists or failing when `information_schema`
 * is inaccessible due to permission restrictions, this engine uses technology fingerprinting
 * (cookies, headers, HTML generators, error traces) to deduce the active web framework
 * and automatically prioritize standard schema tables and columns.
 */

export interface FrameworkProfile {
  name: string;
  confidence: number;
  tables: PredictedTable[];
  indicators: string[];
}

export interface PredictedTable {
  tableName: string;
  priority: number; // 1 = Highest
  description: string;
  highValueColumns: string[];
}

export class SchemaPredictor {
  private static readonly PROFILES: Record<string, PredictedTable[]> = {
    WordPress: [
      {
        tableName: 'wp_users',
        priority: 1,
        description: 'WordPress primary user accounts and password hashes',
        highValueColumns: ['ID', 'user_login', 'user_pass', 'user_email', 'user_registered'],
      },
      {
        tableName: 'wp_usermeta',
        priority: 2,
        description: 'WordPress user roles, capabilities, and session tokens',
        highValueColumns: ['umeta_id', 'user_id', 'meta_key', 'meta_value'],
      },
      {
        tableName: 'wp_options',
        priority: 3,
        description: 'WordPress site options, active plugins, and admin settings',
        highValueColumns: ['option_id', 'option_name', 'option_value'],
      },
    ],
    Django: [
      {
        tableName: 'auth_user',
        priority: 1,
        description: 'Django standard authentication user model with PBKDF2/Argon2 hashes',
        highValueColumns: ['id', 'username', 'password', 'email', 'is_superuser', 'is_staff'],
      },
      {
        tableName: 'django_session',
        priority: 2,
        description: 'Active server-side sessions containing serialized user state',
        highValueColumns: ['session_key', 'session_data', 'expire_date'],
      },
    ],
    Laravel: [
      {
        tableName: 'users',
        priority: 1,
        description: 'Laravel default user accounts with Bcrypt hashes',
        highValueColumns: ['id', 'name', 'email', 'password', 'remember_token', 'created_at'],
      },
      {
        tableName: 'password_resets',
        priority: 2,
        description: 'Password reset tokens',
        highValueColumns: ['email', 'token', 'created_at'],
      },
      {
        tableName: 'personal_access_tokens',
        priority: 3,
        description: 'Laravel Sanctum API tokens',
        highValueColumns: ['id', 'tokenable_id', 'name', 'token', 'abilities'],
      },
    ],
    AspNetIdentity: [
      {
        tableName: 'AspNetUsers',
        priority: 1,
        description: 'ASP.NET Identity user accounts and password hashes',
        highValueColumns: ['Id', 'UserName', 'PasswordHash', 'Email', 'SecurityStamp', 'PhoneNumber'],
      },
      {
        tableName: 'AspNetUserRoles',
        priority: 2,
        description: 'ASP.NET user role assignments (e.g. Administrator mapping)',
        highValueColumns: ['UserId', 'RoleId'],
      },
    ],
    RubyOnRails: [
      {
        tableName: 'users',
        priority: 1,
        description: 'Ruby on Rails / Devise authentication model',
        highValueColumns: ['id', 'email', 'encrypted_password', 'reset_password_token', 'sign_in_count'],
      },
    ],
    SpringSecurity: [
      {
        tableName: 'users',
        priority: 1,
        description: 'Spring Security JDBC default user schema',
        highValueColumns: ['username', 'password', 'enabled'],
      },
      {
        tableName: 'authorities',
        priority: 2,
        description: 'Spring Security role grants',
        highValueColumns: ['username', 'authority'],
      },
    ],
  };

  /**
   * Universal high-value fallback tables across arbitrary applications.
   */
  public static readonly GENERIC_TABLES: PredictedTable[] = [
    {
      tableName: 'users',
      priority: 1,
      description: 'Standard application user store',
      highValueColumns: ['id', 'username', 'email', 'password', 'pass', 'hash', 'token'],
    },
    {
      tableName: 'accounts',
      priority: 2,
      description: 'Customer or member accounts',
      highValueColumns: ['id', 'account_id', 'email', 'password', 'role', 'api_key'],
    },
    {
      tableName: 'admin',
      priority: 3,
      description: 'Administrative credentials table',
      highValueColumns: ['id', 'username', 'password', 'secret', 'is_admin'],
    },
    {
      tableName: 'members',
      priority: 4,
      description: 'Membership portal users',
      highValueColumns: ['id', 'member_id', 'email', 'password', 'auth_token'],
    },
  ];

  /**
   * Detects the web framework from HTTP response telemetry and returns prioritized tables.
   */
  public static predictSchema(telemetry: {
    headers: Record<string, string>;
    cookies?: Record<string, string>;
    bodySnippet?: string;
    url?: string;
  }): FrameworkProfile {
    const indicators: string[] = [];
    const headers = telemetry.headers;
    const cookies = telemetry.cookies || {};
    const body = telemetry.bodySnippet || '';
    const url = telemetry.url || '';

    // 1. WordPress Detection
    if (
      body.includes('wp-content') ||
      body.includes('wp-includes') ||
      url.includes('wp-admin') ||
      Object.keys(cookies).some((c) => c.startsWith('wordpress_'))
    ) {
      indicators.push('WordPress path or cookie marker detected');
      return {
        name: 'WordPress',
        confidence: 0.95,
        tables: this.PROFILES.WordPress,
        indicators,
      };
    }

    // 2. Django Detection
    if (
      cookies['csrftoken'] ||
      cookies['sessionid'] ||
      headers['x-csrftoken'] ||
      body.includes('csrfmiddlewaretoken')
    ) {
      indicators.push('Django CSRF or session token structure detected');
      return {
        name: 'Django',
        confidence: 0.9,
        tables: this.PROFILES.Django,
        indicators,
      };
    }

    // 3. Laravel Detection
    if (
      cookies['laravel_session'] ||
      cookies['XSRF-TOKEN'] ||
      headers['x-powered-by']?.toLowerCase().includes('php')
    ) {
      indicators.push('Laravel session cookie or PHP runtime signature detected');
      return {
        name: 'Laravel',
        confidence: 0.85,
        tables: this.PROFILES.Laravel,
        indicators,
      };
    }

    // 4. ASP.NET Detection
    if (
      cookies['ASP.NET_SessionId'] ||
      cookies['.AspNetCore.Identity'] ||
      headers['x-powered-by']?.includes('ASP.NET') ||
      body.includes('__VIEWSTATE')
    ) {
      indicators.push('ASP.NET ViewState or Session token detected');
      return {
        name: 'ASP.NET Core',
        confidence: 0.9,
        tables: this.PROFILES.AspNetIdentity,
        indicators,
      };
    }

    // 5. Ruby on Rails Detection
    if (cookies['_session_id'] || headers['x-request-id']) {
      indicators.push('Rack/Rails session signature detected');
      return {
        name: 'Ruby on Rails',
        confidence: 0.75,
        tables: this.PROFILES.RubyOnRails,
        indicators,
      };
    }

    // Generic Fallback
    indicators.push('No proprietary framework identified; using universal credential schema candidates');
    return {
      name: 'Generic Web Application',
      confidence: 0.5,
      tables: this.GENERIC_TABLES,
      indicators,
    };
  }
}
