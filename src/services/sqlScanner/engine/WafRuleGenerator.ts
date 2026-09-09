/**
 * SOHE God Rail v3 — Automated WAF Virtual Patch Generator
 *
 * Generates production-ready virtual patch rules to instantly neutralize
 * confirmed injection vulnerabilities at the web perimeter while developers
 * prepare and deploy parameterized code fixes.
 *
 * Supported WAF Ecosystems:
 * 1. Cloudflare WAF (Custom Expression Engine)
 * 2. AWS WAF v2 (JSON Rule Definition)
 * 3. ModSecurity / OWASP Core Rule Set (SecRule DSL)
 * 4. Nginx / OpenResty (Lua Input Filter Snippet)
 */

import { SqlScanFinding } from '../../../types/sqlScanner';

export interface VirtualPatchSet {
  findingId: string;
  parameterName: string;
  cloudflareWaf: string;
  awsWafJson: string;
  modSecuritySecRule: string;
  nginxOpenResty: string;
}

export class WafRuleGenerator {
  /**
   * Generates production virtual patches across all major WAF targets for a finding.
   */
  public static generateVirtualPatches(finding: SqlScanFinding, urlPath: string = '/'): VirtualPatchSet {
    const param = finding.parameterName;
    const cleanPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;

    // 1. Cloudflare WAF Custom Rule
    const cloudflareWaf = `(http.request.uri.path eq "${cleanPath}" and (http.request.uri.query contains "${param}=" or http.request.body.form["${param}"] ne "") and (http.request.uri.query matches "(?i)(union.*select|select.*from|exec.*xp_|waitfor.*delay|pg_sleep)" or http.request.uri.query contains "'" or http.request.uri.query contains "--"))`;

    // 2. AWS WAF v2 Rule (JSON)
    const awsWafJson = JSON.stringify(
      {
        Name: `VirtualPatch-SQLi-${param}`,
        Priority: 1,
        Action: { Block: {} },
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: `VirtualPatchSQLi${param}`,
        },
        Statement: {
          AndStatement: {
            Statements: [
              {
                ByteMatchStatement: {
                  SearchString: cleanPath,
                  FieldToMatch: { UriPath: {} },
                  TextTransformations: [{ Priority: 0, Type: 'LOWERCASE' }],
                  PositionalConstraint: 'EXACTLY',
                },
              },
              {
                SqliMatchStatement: {
                  FieldToMatch: {
                    SingleQueryArgument: { Name: param },
                  },
                  TextTransformations: [
                    { Priority: 0, Type: 'URL_DECODE' },
                    { Priority: 1, Type: 'HTML_ENTITY_DECODE' },
                  ],
                },
              },
            ],
          },
        },
      },
      null,
      2
    );

    // 3. ModSecurity (SecRule)
    const modSecuritySecRule = [
      `# Sentinel Virtual Patch — SQLi in parameter '${param}' on path '${cleanPath}'`,
      `SecRule REQUEST_URI "@beginsWith ${cleanPath}" "id:1000${Math.floor(Math.random() * 899 + 100)},phase:2,t:none,chain,deny,status:403,log,msg:'Sentinel Virtual Patch - SQL Injection blocked on parameter ${param}'"`,
      `  SecRule ARGS:${param} "@rx (?i)(union\\s+select|select\\s+.*\\s+from|insert\\s+into|waitfor\\s+delay|pg_sleep|sleep\\()|['\"--]" "t:none,t:urlDecode,t:htmlEntityDecode"`,
    ].join('\n');

    // 4. Nginx / OpenResty Lua Snippet
    const nginxOpenResty = [
      `# Nginx access_by_lua_block virtual patch for parameter '${param}'`,
      `if ngx.var.uri == "${cleanPath}" then`,
      `  local args = ngx.req.get_uri_args()`,
      `  local val = args["${param}"]`,
      `  if val and type(val) == "string" then`,
      `    if ngx.re.match(val, "(?i)(union\\\\s+select|select\\\\s+.*\\\\s+from|['\\\"--])", "jo") then`,
      `      ngx.log(ngx.WARN, "[Sentinel] Blocked SQLi attempt on ${param}")`,
      `      ngx.exit(ngx.HTTP_FORBIDDEN)`,
      `    end`,
      `  end`,
      `end`,
    ].join('\n');

    return {
      findingId: finding.id,
      parameterName: param,
      cloudflareWaf,
      awsWafJson,
      modSecuritySecRule,
      nginxOpenResty,
    };
  }
}
