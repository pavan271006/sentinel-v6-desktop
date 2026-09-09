import { CandidateParameter, DbmsType } from '../../types/sqlScanner';

export interface OrderByProbe {
  columnCount: number;
  payload: string;
}

export interface NullUnionProbe {
  columnCount: number;
  payload: string;
  dbms: DbmsType;
}

export interface UnionCanaryProbe {
  columnCount: number;
  targetColumnIndex: number;
  canaryMarker: string;
  payload: string;
  dbms: DbmsType;
}

export interface UnionTestResult {
  isUnionVulnerable: boolean;
  estimatedColumnCount?: number;
  renderableColumns: number[];
  detectedCanaries: string[];
  dbms?: DbmsType;
  confidence: number;
  evidence: string;
}

export class UnionTester {
  public static CANARY_PREFIX = 'SENTINEL_CANARY_';

  /**
   * Generates incremental ORDER BY probes to determine column count
   */
  public static getOrderByProbes(param: CandidateParameter, maxColumns = 12): OrderByProbe[] {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const probes: OrderByProbe[] = [];

    for (let c = 1; c <= maxColumns; c++) {
      const payload = isNum
        ? ` ORDER BY ${c}--`
        : `' ORDER BY ${c}-- -`;
      probes.push({ columnCount: c, payload });
    }

    return probes;
  }

  /**
   * Generates incremental NULL-based UNION SELECT probes (essential for Oracle/Postgres/MySQL)
   */
  public static getNullUnionProbes(param: CandidateParameter, maxColumns = 12): NullUnionProbe[] {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const prefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const probes: NullUnionProbe[] = [];

    for (let c = 1; c <= maxColumns; c++) {
      const nulls = Array(c).fill('NULL').join(',');

      // 1. Generic ANSI SQL / PostgreSQL / MySQL / SQLite / MSSQL
      probes.push({
        columnCount: c,
        payload: `${prefix}${nulls}-- -`,
        dbms: 'Generic SQL',
      });

      // 2. Generic ANSI SQL (No trailing comment, optimal for integer/XML endpoints)
      probes.push({
        columnCount: c,
        payload: `${prefix}${nulls}`,
        dbms: 'Generic SQL',
      });

      // 3. Oracle (strictly requires FROM DUAL)
      probes.push({
        columnCount: c,
        payload: `${prefix}${nulls} FROM DUAL--`,
        dbms: 'Oracle',
      });
    }

    return probes;
  }

  /**
   * Generates individual column string-compatibility canary probes
   * Tests each column position individually with text to handle mixed-type schemas (INT + VARCHAR + DATE)
   */
  public static getPerColumnCanaryProbes(param: CandidateParameter, columnCount: number): UnionCanaryProbe[] {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const prefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const probes: UnionCanaryProbe[] = [];

    for (let col = 1; col <= columnCount; col++) {
      const marker = `${UnionTester.CANARY_PREFIX}${col < 10 ? '0' + col : col}`;

      // Build array where only targetColumnIndex is the evaluated string marker, and others are NULL
      const rowCells: string[] = [];
      const rowCellsOracle: string[] = [];
      const rowCellsMssql: string[] = [];
      const rowCellsMysql: string[] = [];
      
      const p1 = marker.substring(0, 8);
      const p2 = marker.substring(8);

      for (let i = 1; i <= columnCount; i++) {
        if (i === col) {
          rowCells.push(`'${p1}'||'${p2}'`);             // Generic/PG/SQLite
          rowCellsOracle.push(`'${p1}'||'${p2}'`);       // Oracle
          rowCellsMssql.push(`'${p1}'+'${p2}'`);         // MSSQL
          rowCellsMysql.push(`CONCAT('${p1}','${p2}')`); // MySQL
        } else {
          rowCells.push('NULL');
          rowCellsOracle.push('NULL');
          rowCellsMssql.push('NULL');
          rowCellsMysql.push('NULL');
        }
      }

      // 1. Generic SQL / PostgreSQL / SQLite
      probes.push({
        columnCount,
        targetColumnIndex: col,
        canaryMarker: marker,
        payload: `${prefix}${rowCells.join(',')}-- -`,
        dbms: 'Generic SQL',
      });

      // 1B. Generic SQL without trailing comment
      if (isNum) {
        probes.push({
          columnCount,
          targetColumnIndex: col,
          canaryMarker: marker,
          payload: `${prefix}${rowCells.join(',')}`,
          dbms: 'Generic SQL',
        });
      }

      // 2. Oracle (FROM DUAL)
      probes.push({
        columnCount,
        targetColumnIndex: col,
        canaryMarker: marker,
        payload: `${prefix}${rowCellsOracle.join(',')} FROM DUAL--`,
        dbms: 'Oracle',
      });
      
      // 3. MSSQL
      probes.push({
        columnCount,
        targetColumnIndex: col,
        canaryMarker: marker,
        payload: `${prefix}${rowCellsMssql.join(',')}-- -`,
        dbms: 'Microsoft SQL Server',
      });
      
      // 4. MySQL
      probes.push({
        columnCount,
        targetColumnIndex: col,
        canaryMarker: marker,
        payload: `${prefix}${rowCellsMysql.join(',')}-- -`,
        dbms: 'MySQL',
      });
    }

    return probes;
  }

  /**
   * Generates harmless canary UNION SELECT probes for all columns combined
   */
  public static getUnionCanaryProbes(param: CandidateParameter, columnCount: number): {
    columnCount: number;
    canaries: { index: number; marker: string }[];
    payload: string;
    dbms: DbmsType;
  }[] {
    const isNum = /^\d+$/.test(param.originalValue.trim());
    const prefix = isNum ? ' UNION SELECT ' : '\' UNION SELECT ';
    const suffix = '-- -';

    const probes: {
      columnCount: number;
      canaries: { index: number; marker: string }[];
      payload: string;
      dbms: DbmsType;
    }[] = [];
    const canaries: { index: number; marker: string }[] = [];

    const stringCells: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      const marker = `${UnionTester.CANARY_PREFIX}${i < 10 ? '0' + i : i}`;
      canaries.push({ index: i, marker });
      stringCells.push(`'${marker}'`);
    }

    // 1. Standard ANSI SQL / MySQL / Postgres / SQLite
    probes.push({
      columnCount,
      canaries,
      payload: `${prefix}${stringCells.join(',')}${suffix}`,
      dbms: 'Generic SQL',
    });

    // 2. Oracle (requires FROM DUAL)
    probes.push({
      columnCount,
      canaries,
      payload: `${prefix}${stringCells.join(',')} FROM DUAL--`,
      dbms: 'Oracle',
    });

    return probes;
  }

  /**
   * Checks if any harmless canary marker was reflected in the response body
   */
  public static inspectUnionCanaries(
    responseBody: string,
    probes: {
      columnCount: number;
      canaries: { index: number; marker: string }[];
      payload: string;
      dbms: DbmsType;
    }[]
  ): UnionTestResult {
    const detectedCanaries: string[] = [];
    const renderableColumns: number[] = [];
    let detectedDbms: DbmsType | undefined;

    for (const probe of probes) {
      for (const canary of probe.canaries) {
        if (responseBody.includes(canary.marker)) {
          if (!detectedCanaries.includes(canary.marker)) {
            detectedCanaries.push(canary.marker);
            renderableColumns.push(canary.index);
            detectedDbms = probe.dbms;
          }
        }
      }
    }

    const isUnionVulnerable = detectedCanaries.length > 0;
    const confidence = isUnionVulnerable ? 100 : 0;
    const evidence = isUnionVulnerable
      ? `UNION SQLi confirmed: Harmless canary tokens [${detectedCanaries.join(', ')}] rendered at column position(s) [${renderableColumns.join(', ')}]`
      : 'No canary reflection detected in UNION probes';

    return {
      isUnionVulnerable,
      renderableColumns,
      detectedCanaries,
      dbms: detectedDbms,
      confidence,
      evidence,
    };
  }
}
