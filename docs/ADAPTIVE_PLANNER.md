# UCMA-X — Bayesian Adaptive Test Planner & Information Theory Model

**Mathematical Standard:** Information-Theoretic Active Learning & Decision Theory  
**Engine Implementation:** `src/services/sqlScanner/engine/AdaptiveTestPlanner.ts` & `HypothesisEngine.ts`  

---

## 1. Information-Theoretic Formulation

The UCMA-X planner rejects hardcoded scan sequences. Instead, test selection is framed as an **Active Information Gathering Optimization Problem** over a discrete probability space.

### 1.1 Belief State & Shannon Entropy
At step $t$, the scanner maintains probability distributions over the target's SQL Context $\Theta_{ctx}$ and DBMS $\Theta_{dbms}$:

$$P(\Theta_{ctx} = c), \quad \sum_{c \in \mathcal{C}} P(c) = 1$$

The remaining uncertainty is quantified via **Shannon Entropy**:

$$H(\Theta_{ctx}) = -\sum_{c \in \mathcal{C}} P(c) \log_2 P(c) \quad [\text{bits}]$$

```
High Entropy (2.71 bits) ────── Observation ──────► Low Entropy (0.00 bits)
 (All contexts equal prior)                           (Context = single_quote_string)
```

---

### 1.2 Expected Information Gain (EIG)
For a candidate experiment $T$, the Expected Information Gain measures the anticipated reduction in Shannon entropy:

$$\text{EIG}(T) = H(\Theta) - \sum_{o \in \mathcal{O}} P(o \mid T) H(\Theta \mid o)$$

Where:
- $\mathcal{O} = \{\text{Positive}, \text{Negative}, \text{Error}, \text{Inconclusive}\}$ is the observation space.
- $P(o \mid T)$ is the marginal likelihood of observing outcome $o$.

---

### 1.3 Utility Optimization Function
To balance diagnostic power against network overhead, the planner optimizes **Utility per Sub-Linear Request Cost**:

$$\text{Utility}(T) = \frac{\text{EIG}(T)}{\left( \max(1, \text{Cost}(T)) \right)^{0.7}}$$

Where:
- $\text{Cost}(T)$ is the number of HTTP requests required (e.g. 1 for CAST, 2 for Boolean differential, 3+ for SPRT).
- The exponent $0.7$ applies a sub-linear penalty to multi-request probes, favoring high-yield deterministic tests while allowing thorough verification when entropy remains high.

```
Candidate Pool
  ├─► Filter: CompatibilityRules.isCompatible(T, Context, DBMS)
  ├─► Calculate: EIG(T) & Cost(T)
  └─► Select: argmax_{T} Utility(T)
```

---

## 2. Test State Machine Lifecycle

Every candidate experiment transitions through strict state machine phases:

```
[ QUEUED ] ───► [ RUNNING ] ───► [ COMPLETED ] ───► [ POSTERIOR UPDATE ]
     │                │
     ▼                ▼
[ SKIPPED ]      [ CANCELLED ] (Early Stopping / Redundancy Pruning)
```

1. `QUEUED`: Generated candidate experiment awaiting worker allocation.
2. `RUNNING`: Dispatched to bounded parallel worker pool or sequential timing lane.
3. `COMPLETED`: Response received, analyzed by `MultiOracleEvaluator`, posterior beliefs updated.
4. `SKIPPED`: Pruned before transmission due to context/DBMS incompatibility.
5. `CANCELLED`: Obsoleted while queued because prior experiment resolved the hypothesis (e.g. early stopping upon $\ge 95\%$ confidence).

---

## 3. Mathematical Proof of Adaptivity ($X \neq Y$)

A scanner is adaptive if and only if:

$$\exists \, S, o_A, o_B \text{ such that } \text{Planner}(S \mid o_A) = T_X \neq T_Y = \text{Planner}(S \mid o_B)$$

### Verified Proof in UCMA-X Test Suite:
1. **Initial State $S$**: Target HTTP parameter `sort_field` with ambiguous context prior.
2. **Observation $o_A$**: Parameter reflects inside sorting clause (`detectedContext = 'order_by_clause'`).
   - Posterior: $P(\text{order\_by\_clause}) = 0.90$.
   - Selected Next Experiment $T_X$: `ORDER_BOUNDARY_TEST` (`(CASE WHEN (1=1) THEN 1 ELSE 2 END)`).
3. **Observation $o_B$**: Parameter produces PostgreSQL type error (`1=CAST(...)` syntax error).
   - Posterior: $P(\text{PostgreSQL}) = 0.95, P(\text{where\_clause}) = 0.90$.
   - Selected Next Experiment $T_Y$: `ERROR_BEHAVIOR_TEST` (`1=CAST((SELECT table_name...) AS int)`).
4. **Result**: $T_X \neq T_Y$. The next experiment dynamically changes according to empirical evidence.
