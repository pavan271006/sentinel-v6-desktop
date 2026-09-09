import { ScanStage } from '../ScanPipeline';
import { ScanContext } from '../ScanContext';
import { ErrorTester } from '../../ErrorTester';
import { BooleanTester } from '../../BooleanTester';
import { UnionTester } from '../../UnionTester';
import { TimeBasedTester } from '../../TimeBasedTester';
import { UnifiedResponseOracle } from '../../engine/UnifiedResponseOracle';
import { InteractshClient } from '../../engine/InteractshClient';
import { OobManager } from '../../OobManager';
import { SqlScanFinding, SqlScanEvidence } from '../../../../types/sqlScanner';

export class MultiOracleDiscoveryStage implements ScanStage {
  public readonly id = 'multi_oracle_discovery';
  public readonly name = 'Multi-Oracle Injection Discovery & Differential Probing';

  public async execute(ctx: ScanContext): Promise<void> {
    const totalParams = ctx.candidateParameters.length;
    if (totalParams === 0) {
      ctx.log('info', 'No candidate parameters found for multi-oracle discovery.');
      return;
    }

    ctx.log('info', `Running Multi-Oracle Discovery across ${totalParams} parameter(s)...`);

    for (let pIdx = 0; pIdx < totalParams; pIdx++) {
      const param = ctx.candidateParameters[pIdx];
      if (ctx.isAborted) return;
      if (!param.enabled) continue;

      let paramIsVulnerable = false;
      const baseProgress = 38 + Math.round((pIdx / totalParams) * 24);
      ctx.progress('Multi-Oracle Discovery', `Testing parameter "${param.name}"`, baseProgress, param.name);
      param.testsExecuted = (param.testsExecuted || 0) + 1;

      // ─── Channel 1: Error-Based & Type Conversion Probes ───────────────────
      if (ctx.target.testedInjectionTypes?.errorBased !== false && (!paramIsVulnerable || ctx.safetyConfig.scanMode === 'deep')) {
        const prog = 38 + Math.round(((pIdx + 0.1) / totalParams) * 24);
        ctx.progress('Multi-Oracle Discovery', `[1/5] Error oracle probing: "${param.name}"`, prog, param.name);

        const errorProbes = ctx.safetyConfig.scanMode === 'quick'
          ? ErrorTester.getPrecisionErrorProbes().slice(0, 4)
          : ErrorTester.getPrecisionErrorProbes();

        for (const probe of errorProbes) {
          if (ctx.isAborted) return;
          const res = await ctx.sendMutatedRequest(param, probe.payload);
          const errorMatch = UnifiedResponseOracle.inspectError(res.body);

          if (errorMatch) {
            ctx.log('success', `[ERROR ORACLE] Detected ${errorMatch.patternName} on "${param.name}" (${errorMatch.dbms})`);

            if (ctx.dbmsFingerprint.dbms === 'Unknown' || errorMatch.confidence > ctx.dbmsFingerprint.confidenceScore) {
              ctx.dbmsFingerprint = {
                dbms: errorMatch.dbms,
                confidence: 'Confirmed',
                confidenceScore: errorMatch.confidence,
                evidence: [`Error pattern: ${errorMatch.matchedText}`],
              };
              ctx.catalog.dbms = errorMatch.dbms;
            }

            ctx.verifiedVector = 'ERROR';
            ctx.verifiedParamId = param.id;
            paramIsVulnerable = true;

            const ev: SqlScanEvidence = {
              id: `ev-err-${Date.now()}`,
              title: `Error Leaked on Parameter ${param.name}`,
              timestamp: Date.now(),
              injectionType: 'Error-based',
              parameterName: param.name,
              parameterLocation: param.location,
              payload: probe.payload,
              baselineStatus: ctx.baseline.status,
              baselineLength: ctx.baseline.contentLength,
              baselineDurationMs: ctx.baseline.durationMs,
              testStatus: res.status,
              testLength: res.body.length,
              testDurationMs: res.durationMs,
              rawRequest: res.rawRequest || '',
              rawResponse: res.rawResponse || '',
              matchedPattern: errorMatch.matchedText,
              analysisSummary: `Direct database error output identified: ${errorMatch.matchedText}`,
            };

            const finding: SqlScanFinding = {
              id: `finding-err-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              title: `Error-Based SQL Injection (${errorMatch.dbms})`,
              parameterName: param.name,
              parameterLocation: param.location,
              url: ctx.target.url,
              httpMethod: ctx.target.method,
              dbms: errorMatch.dbms,
              detectionMethod: 'Type-Casting Error Oracle',
              injectionType: 'Error-based',
              severity: 'Critical',
              confidence: 'Confirmed',
              confidenceScore: errorMatch.confidence,
              confidenceBreakdown: {
                score: errorMatch.confidence,
                level: 'Confirmed',
                factors: [
                  { name: 'Direct Error Signature Match', points: 60, description: errorMatch.patternName },
                  { name: 'Data Leakage Token', points: 40, description: `Leaked: ${errorMatch.leakedData || errorMatch.matchedText}` },
                ],
              },
              evidence: [ev],
              reproductionRequest: res.rawRequest || '',
              reproductionResponse: res.rawResponse || '',
              remediation: 'Implement parameterized queries / prepared statements immediately.',
              cwe: 'CWE-89',
              owaspCategory: 'A03:2021-Injection',
              timestamp: Date.now(),
              sqliDetected: true,
              sqlStructureControl: true,
            };
            ctx.addFinding(finding);
            break;
          }
        }
      }

      // ─── Channel 2: Boolean & Conditional Error Probes ──────────────────────
      if (ctx.target.testedInjectionTypes?.booleanBased !== false && (!paramIsVulnerable || ctx.safetyConfig.scanMode === 'deep')) {
        const prog = 38 + Math.round(((pIdx + 0.3) / totalParams) * 24);
        ctx.progress('Multi-Oracle Discovery', `[2/5] Boolean differential probing: "${param.name}"`, prog, param.name);

        const booleanPairs = BooleanTester.getTestPairs(param);
        const pairsToTest = ctx.safetyConfig.scanMode === 'quick' ? booleanPairs.slice(0, 8) : booleanPairs;

        for (const pair of pairsToTest) {
          if (ctx.isAborted) return;
          const trueRes = await ctx.sendMutatedRequest(param, pair.truePayload);
          const falseRes = await ctx.sendMutatedRequest(param, pair.falsePayload);

          const evalResult = UnifiedResponseOracle.evaluatePair(
            ctx.baseline.body,
            ctx.baseline.status,
            trueRes,
            falseRes,
            pair.truePayload,
            pair.falsePayload
          );

          if (evalResult.isVulnerable) {
            ctx.log('success', `[BOOLEAN ORACLE] Confirmed differential on "${param.name}" (${evalResult.primaryChannel}, confidence: ${evalResult.confidence}%)`);

            if (evalResult.uniqueMarker) {
              ctx.activeMarker = evalResult.uniqueMarker;
            }
            if (evalResult.divergencePolarity) {
              ctx.errorPolarity = evalResult.divergencePolarity === 'normal' ? 'standard' : evalResult.divergencePolarity;
            }

            const dbms = (pair.dbms !== 'Generic SQL' ? pair.dbms : ctx.dbmsFingerprint.dbms !== 'Unknown' ? ctx.dbmsFingerprint.dbms : 'Generic SQL') as any;

            if (pair.dbms !== 'Generic SQL' && ctx.dbmsFingerprint.dbms === 'Unknown') {
              ctx.dbmsFingerprint = {
                dbms: pair.dbms,
                confidence: 'High',
                confidenceScore: evalResult.confidence,
                evidence: [`Divergence on ${pair.name}`],
              };
              ctx.catalog.dbms = pair.dbms;
            }

            ctx.verifiedVector = evalResult.isConditionalError ? 'CONDITIONAL_ERROR' : 'BOOLEAN';
            ctx.verifiedParamId = param.id;
            paramIsVulnerable = true;

            const ev: SqlScanEvidence = {
              id: `ev-bool-${Date.now()}`,
              title: `Differential Probing on Parameter ${param.name}`,
              timestamp: Date.now(),
              injectionType: 'Boolean-based',
              parameterName: param.name,
              parameterLocation: param.location,
              payload: `${pair.truePayload} vs ${pair.falsePayload}`,
              baselineStatus: ctx.baseline.status,
              baselineLength: ctx.baseline.contentLength,
              baselineDurationMs: ctx.baseline.durationMs,
              testStatus: trueRes.status,
              testLength: trueRes.body.length,
              testDurationMs: trueRes.durationMs,
              rawRequest: trueRes.rawRequest || '',
              rawResponse: trueRes.rawResponse || '',
              matchedPattern: evalResult.uniqueMarker,
              analysisSummary: evalResult.evidence,
            };

            const finding: SqlScanFinding = {
              id: `finding-bool-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              title: evalResult.isConditionalError ? `Conditional Error SQL Injection (${pair.dbms})` : `Boolean-Based Blind SQL Injection`,
              parameterName: param.name,
              parameterLocation: param.location,
              url: ctx.target.url,
              httpMethod: ctx.target.method,
              dbms,
              detectionMethod: 'Differential Invariant Oracle',
              injectionType: 'Boolean-based',
              severity: 'High',
              confidence: evalResult.confidence >= 95 ? 'Confirmed' : 'High',
              confidenceScore: evalResult.confidence,
              confidenceBreakdown: {
                score: evalResult.confidence,
                level: evalResult.confidence >= 95 ? 'Confirmed' : 'High',
                factors: [
                  { name: 'Deterministic Differential Divergence', points: 50, description: evalResult.evidence },
                  { name: 'Differential Marker Isolation', points: 30, description: `Marker: ${evalResult.uniqueMarker || 'Status Divergence'}` },
                ],
              },
              evidence: [ev],
              reproductionRequest: trueRes.rawRequest || '',
              reproductionResponse: trueRes.rawResponse || '',
              remediation: 'Use parameterized queries / prepared statements and validate input bounds.',
              cwe: 'CWE-89',
              owaspCategory: 'A03:2021-Injection',
              timestamp: Date.now(),
              sqliDetected: true,
              sqlStructureControl: true,
            };
            ctx.addFinding(finding);
            break;
          }
        }
      }

      // ─── Channel 3: UNION & Column Canary Discovery ────────────────────────
      if (ctx.target.testedInjectionTypes?.unionBased !== false && (!paramIsVulnerable || ctx.safetyConfig.scanMode === 'deep')) {
        const prog = 38 + Math.round(((pIdx + 0.5) / totalParams) * 24);
        ctx.progress('Multi-Oracle Discovery', `[3/5] UNION & column canary testing: "${param.name}"`, prog, param.name);

        const maxCols = ctx.safetyConfig.maxUnionColumns || (ctx.safetyConfig.scanMode === 'quick' ? 6 : ctx.safetyConfig.scanMode === 'deep' ? 30 : 15);
        let determinedColumns = 0;

        // 1. ORDER BY Column Count Discovery
        const orderProbes = UnionTester.getOrderByProbes(param, maxCols);
        let prevStatus = ctx.baseline.status;
        for (const op of orderProbes) {
          if (ctx.isAborted) return;
          const res = await ctx.sendMutatedRequest(param, op.payload);
          if (res.status >= 400 || (prevStatus < 400 && res.status >= 400)) {
            determinedColumns = Math.max(1, op.columnCount - 1);
            ctx.log('info', `[UNION ORACLE] ORDER BY boundary discovered: ~${determinedColumns} columns on "${param.name}"`);
            break;
          }
          prevStatus = res.status;
        }

        // 2. NULL-based & Canary Injection Probes
        const colsToTest = determinedColumns > 0
          ? [determinedColumns]
          : Array.from({ length: Math.min(maxCols, 12) }, (_, i) => i + 1);
        for (const colCount of colsToTest) {
          if (ctx.isAborted || paramIsVulnerable) break;
          const canaryProbes = UnionTester.getPerColumnCanaryProbes(param, colCount);

          for (const cp of canaryProbes) {
            if (ctx.isAborted) return;
            const res = await ctx.sendMutatedRequest(param, cp.payload);

            if (res.body.includes(cp.canaryMarker)) {
              const matchedCanary = true;
              const detectedDbms = cp.payload.includes('FROM DUAL') ? 'Oracle' : (cp.dbms || 'Generic SQL');
              ctx.log('success', `[UNION ORACLE] Confirmed UNION SQLi on "${param.name}" (${colCount} columns, canary "${cp.canaryMarker}" reflected at column ${cp.targetColumnIndex}, DBMS: ${detectedDbms})`);

              ctx.verifiedVector = 'UNION';
              ctx.verifiedParamId = param.id;
              ctx.unionColumnCount = colCount;
              if (!ctx.unionRenderColumns.includes(cp.targetColumnIndex)) {
                ctx.unionRenderColumns.push(cp.targetColumnIndex);
              }
              ctx.unionDbms = detectedDbms as any;
              ctx.dbmsFingerprint = {
                dbms: detectedDbms as any,
                confidence: 'Confirmed',
                confidenceScore: 100,
                evidence: [`${detectedDbms} UNION reflection verified: canary rendered at column ${cp.targetColumnIndex} of ${colCount}`],
              };
              ctx.catalog.dbms = detectedDbms as any;
              ctx.catalog.columnCount = colCount;
              ctx.catalog.renderColumn = cp.targetColumnIndex;
              paramIsVulnerable = true;

              const ev: SqlScanEvidence = {
                id: `ev-union-${Date.now()}`,
                title: `UNION-Based SQL Injection on Parameter ${param.name}`,
                timestamp: Date.now(),
                injectionType: 'UNION-based',
                parameterName: param.name,
                parameterLocation: param.location,
                payload: cp.payload,
                baselineStatus: ctx.baseline.status,
                baselineLength: ctx.baseline.contentLength,
                baselineDurationMs: ctx.baseline.durationMs,
                testStatus: res.status,
                testLength: res.body.length,
                testDurationMs: res.durationMs,
                rawRequest: res.rawRequest || '',
                rawResponse: res.rawResponse || '',
                matchedPattern: matchedCanary ? cp.canaryMarker : 'UNION Output Reflected',
                analysisSummary: `UNION query successfully executed with ${colCount} columns (${detectedDbms}).`,
              };

              const finding: SqlScanFinding = {
                id: `finding-union-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                title: `UNION-Based SQL Injection (${colCount} Columns)`,
                parameterName: param.name,
                parameterLocation: param.location,
                url: ctx.target.url,
                httpMethod: ctx.target.method,
                dbms: detectedDbms as any,
                detectionMethod: 'UNION Reflection Oracle',
                injectionType: 'UNION-based',
                severity: 'Critical',
                confidence: 'Confirmed',
                confidenceScore: 100,
                confidenceBreakdown: {
                  score: 100,
                  level: 'Confirmed',
                  factors: [
                    { name: 'UNION Column Layout Proven', points: 60, description: `${colCount} columns verified` },
                    { name: 'Canary Marker Reflection', points: 40, description: matchedCanary ? cp.canaryMarker : 'Response delta verified' },
                  ],
                },
                evidence: [ev],
                reproductionRequest: res.rawRequest || '',
                reproductionResponse: res.rawResponse || '',
                remediation: 'Implement parameterized queries to completely isolate SQL command structure from user parameters.',
                cwe: 'CWE-89',
                owaspCategory: 'A03:2021-Injection',
                timestamp: Date.now(),
                sqliDetected: true,
                sqlStructureControl: true,
              };
              ctx.addFinding(finding);
              break;
            }
          }
        }
      }

      // ─── Channel 4: Time-Based & SPRT Wald Timing Probes ───────────────────
      if (ctx.target.testedInjectionTypes?.timeBased !== false && (!paramIsVulnerable || ctx.safetyConfig.scanMode === 'deep')) {
        const prog = 38 + Math.round(((pIdx + 0.7) / totalParams) * 24);
        ctx.progress('Multi-Oracle Discovery', `[4/5] Time-based delay testing: "${param.name}"`, prog, param.name);

        const isFastMode = ctx.safetyConfig.scanMode === 'quick' || ctx.scanProfile === 'fast_triage';
        const delaySeconds = isFastMode ? 1.5 : 3;
        const delayProbes = TimeBasedTester.getDelayPayloads(param, delaySeconds);
        const probesToRun = isFastMode ? delayProbes.slice(0, 2) : delayProbes;

        for (const probe of probesToRun) {
          if (ctx.isAborted) return;
          const res = await ctx.sendMutatedRequest(param, probe.payload);
          const thresholdMs = isFastMode
            ? Math.max(1200, (ctx.baseline.meanDurationMs || 200) + (delaySeconds * 750))
            : Math.max(2500, (ctx.baseline.meanDurationMs || 300) + (delaySeconds * 800));

          if (res.durationMs >= thresholdMs) {
            // Confirm with immediate second sample to avoid transient latency spikes
            const confirmRes = await ctx.sendMutatedRequest(param, probe.payload);
            if (confirmRes.durationMs >= thresholdMs) {
              ctx.log('success', `[TIME ORACLE] Confirmed Time-Based Blind delay on "${param.name}" (${probe.dbms}, latency: ${confirmRes.durationMs}ms)`);

              if (ctx.dbmsFingerprint.dbms === 'Unknown' && probe.dbms !== 'Generic SQL') {
                ctx.dbmsFingerprint = {
                  dbms: probe.dbms,
                  confidence: 'High',
                  confidenceScore: 92,
                  evidence: [`Time delay satisfied on ${probe.dbms} sleep syntax`],
                };
                ctx.catalog.dbms = probe.dbms;
              }

              ctx.verifiedVector = 'TIME';
              ctx.verifiedParamId = param.id;
              paramIsVulnerable = true;

              const ev: SqlScanEvidence = {
                id: `ev-time-${Date.now()}`,
                title: `Time-Based Blind Delay on Parameter ${param.name}`,
                timestamp: Date.now(),
                injectionType: 'Time-based',
                parameterName: param.name,
                parameterLocation: param.location,
                payload: probe.payload,
                baselineStatus: ctx.baseline.status,
                baselineLength: ctx.baseline.contentLength,
                baselineDurationMs: ctx.baseline.durationMs,
                testStatus: confirmRes.status,
                testLength: confirmRes.body.length,
                testDurationMs: confirmRes.durationMs,
                rawRequest: confirmRes.rawRequest || '',
                rawResponse: confirmRes.rawResponse || '',
                matchedPattern: `Sleep Delay ${delaySeconds}s Verified (${confirmRes.durationMs}ms vs Baseline ${ctx.baseline.meanDurationMs.toFixed(0)}ms)`,
                analysisSummary: `Database sleep query injected and verified with deterministic ${delaySeconds}s latency delay.`,
              };

              const finding: SqlScanFinding = {
                id: `finding-time-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                title: `Time-Based Blind SQL Injection (${probe.dbms})`,
                parameterName: param.name,
                parameterLocation: param.location,
                url: ctx.target.url,
                httpMethod: ctx.target.method,
                dbms: probe.dbms,
                detectionMethod: 'SPRT Wald Timing Invariant Oracle',
                injectionType: 'Time-based',
                severity: 'High',
                confidence: 'High',
                confidenceScore: 92,
                confidenceBreakdown: {
                  score: 92,
                  level: 'High',
                  factors: [
                    { name: 'Deterministic Timing Latency Delta', points: 60, description: `Observed ${confirmRes.durationMs}ms delay` },
                    { name: 'Two-Stage Likelihood Confirmation', points: 32, description: 'Repeated probe confirmation' },
                  ],
                },
                evidence: [ev],
                reproductionRequest: confirmRes.rawRequest || '',
                reproductionResponse: confirmRes.rawResponse || '',
                remediation: 'Implement Parameterized Queries and strict input type checking.',
                cwe: 'CWE-89',
                owaspCategory: 'A03:2021-Injection',
                timestamp: Date.now(),
                sqliDetected: true,
                sqlStructureControl: true,
              };
              ctx.addFinding(finding);
              break;
            }
          }
        }
      }

      // ─── Channel 5: Out-of-Band (OAST) Blind Callbacks ──────────────────────
      if ((ctx.target.testedInjectionTypes as any)?.outOfBand !== false && ctx.target.oobConfig?.enabled !== false && (!paramIsVulnerable || ctx.safetyConfig.scanMode === 'deep')) {
        const prog = 38 + Math.round(((pIdx + 0.9) / totalParams) * 24);
        ctx.progress('Multi-Oracle Discovery', `[5/5] Out-of-band (OAST) probing: "${param.name}"`, prog, param.name);

        try {
          const oastClient = InteractshClient.getInstance();
          if (!oastClient.getSession()) {
            await oastClient.initialize(ctx.target.oobConfig?.providerUrl, ctx.target.oobConfig?.domain);
          }
          const session = oastClient.getSession();
          const oobDomain = ctx.target.oobConfig?.domain || session?.domain || 'oast.sentinel.local';
          const { token, fqdn } = OobManager.generateToken(param, ctx.target.url, ctx.dbmsFingerprint.dbms, oobDomain);
          oastClient.registerToken(token, param.name, ctx.dbmsFingerprint.dbms, 'dns', fqdn);

          const oobProbes = OobManager.getOobPayloads(param, fqdn).slice(0, 3);
          for (const op of oobProbes) {
            if (ctx.isAborted) break;
            await ctx.sendMutatedRequest(param, op.payload, { append: true });
          }

          const isOffline = session?.isOffline ?? true;
          const interactions = await oastClient.pollInteractions(isOffline ? 50 : 1500);

          const hasCallback =
            oastClient.hasInteractionForParam(interactions, param.name) ||
            interactions.some((i) => i.correlationToken === token || i.fullId.includes(token));

          if (hasCallback) {
            const matchedInteraction = interactions.find((i) => i.correlationToken === token || i.fullId.includes(token)) || interactions[0];
            const confirmedDbms = (oastClient.getConfirmedDbms(matchedInteraction) as any) || (matchedInteraction ? 'Oracle' : ctx.dbmsFingerprint.dbms);

            if (confirmedDbms && confirmedDbms !== 'Unknown') {
              ctx.dbmsFingerprint = {
                dbms: confirmedDbms,
                confidence: 'Confirmed',
                confidenceScore: 99,
                evidence: [`Out-of-band ${matchedInteraction.protocol?.toUpperCase() || 'DNS'} interaction triggered`],
              };
              ctx.catalog.dbms = confirmedDbms;
            }

            ctx.verifiedVector = 'OOB';
            ctx.verifiedParamId = param.id;

            const ev: SqlScanEvidence = {
              id: `ev-oob-${Date.now()}`,
              title: `Out-of-Band (OAST) Callback Confirmed`,
              timestamp: Date.now(),
              injectionType: 'Out-of-Band (OAST)',
              parameterName: param.name,
              parameterLocation: param.location,
              payload: oobProbes[0]?.payload || `OAST callback to ${fqdn}`,
              baselineStatus: ctx.baseline.status,
              baselineLength: ctx.baseline.contentLength,
              baselineDurationMs: ctx.baseline.durationMs,
              testStatus: ctx.baseline.status,
              testLength: ctx.baseline.contentLength,
              testDurationMs: ctx.baseline.durationMs,
              rawRequest: '',
              rawResponse: '',
              analysisSummary: `Asynchronous Out-of-Band interaction received for token ${token}.`,
            };

            const finding: SqlScanFinding = {
              id: `finding-oob-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              title: `Out-of-Band (OAST) SQL Injection (${confirmedDbms})`,
              parameterName: param.name,
              parameterLocation: param.location,
              url: ctx.target.url,
              httpMethod: ctx.target.method,
              dbms: confirmedDbms,
              detectionMethod: 'OAST Asynchronous Invariant Oracle',
              injectionType: 'Out-of-Band (OAST)',
              severity: 'Critical',
              confidence: 'Confirmed',
              confidenceScore: 99,
              confidenceBreakdown: {
                score: 99,
                level: 'Confirmed',
                factors: [
                  { name: 'OAST DNS/HTTP Callback Verified', points: 90, description: `Token ${token} callback` },
                ],
              },
              evidence: [ev],
              reproductionRequest: '',
              reproductionResponse: '',
              remediation: 'Implement strongly typed Parameterized Queries to prevent user data from breaking SQL execution contexts.',
              cwe: 'CWE-89',
              owaspCategory: 'A03:2021-Injection',
              timestamp: Date.now(),
              sqliDetected: true,
              sqlStructureControl: true,
            };
            ctx.addFinding(finding);
          }
        } catch (err) {
          console.error('[MultiOracleDiscoveryStage] OOB Channel Error:', err);
        }
      }
    }
  }
}
