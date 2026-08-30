import unittest
import sys
import os

# Add root directory so 'research....' is importable
root_dir = r'c:\Users\Legion 5 pro\Desktop\cyber sec'
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

research_dir = os.path.join(root_dir, 'research')
if research_dir not in sys.path:
    sys.path.insert(0, research_dir)

loader = unittest.TestLoader()
suite = loader.discover(start_dir=research_dir, pattern='test_*.py')

runner = unittest.TextTestRunner(verbosity=2)
result = runner.run(suite)

print("\n" + "="*80)
print(f"RESEARCH SUITE RUN SUMMARY:")
print(f"Ran {result.testsRun} tests.")
print(f"Errors: {len(result.errors)}")
print(f"Failures: {len(result.failures)}")
print(f"Skipped: {len(result.skipped)}")
print(f"OVERALL STATUS: {'PASS' if result.wasSuccessful() else 'FAIL'}")
print("="*80)
