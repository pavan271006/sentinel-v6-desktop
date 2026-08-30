import os
import ast

engine_files = [
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\research\prototypes\adaptive_test_planner\planner.py',
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\research\prototypes\differential_security_engine\engine.py',
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\research\prototypes\http_desync_detector\detector.py',
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\research\prototypes\security_context_graph\engine.py',
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\research\theory_lab\causal_evidence_engine\engine.py',
    r'c:\Users\Legion 5 pro\Desktop\cyber sec\research\theory_lab\state_machine_inference\inference_engine.py',
]

print("="*80)
print("FACADE & DUMMY IMPLEMENTATION DETECTION AUDIT")
print("="*80)

for p in engine_files:
    fname = os.path.basename(os.path.dirname(p)) + '/' + os.path.basename(p)
    if not os.path.exists(p):
        print(f"MISSING: {fname}")
        continue
    with open(p, 'r', encoding='utf-8', errors='ignore') as f:
        code = f.read()
    
    tree = ast.parse(code)
    func_count = 0
    class_count = 0
    empty_funcs = []
    
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            func_count += 1
            # Check if function body is just 'pass' or 'return <const>'
            if len(node.body) == 1:
                stmt = node.body[0]
                if isinstance(stmt, ast.Pass):
                    empty_funcs.append(node.name)
                elif isinstance(stmt, ast.Return) and isinstance(stmt.value, (ast.Constant, ast.NameConstant)):
                    empty_funcs.append(f"{node.name} (constant return: {ast.unparse(stmt.value) if hasattr(ast, 'unparse') else 'const'})")
        elif isinstance(node, ast.ClassDef):
            class_count += 1
            
    print(f"Engine: {fname:<45} | Classes: {class_count:>2} | Functions: {func_count:>2} | Lines: {len(code.splitlines()):>4} | Empty/Stub funcs: {len(empty_funcs)}")
    if empty_funcs:
        for ef in empty_funcs:
            print(f"    - Flagged stub: {ef}")
