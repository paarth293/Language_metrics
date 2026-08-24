import subprocess
import sys
import os

TESTS = [
    ("CSRF Protection", "test_csrf.py"),
    ("Session Token Integrity", "test_session_token.py"),
    ("Role-Based Access Control", "test_rbac.py"),
    ("Audit Logging", "test_audit_log.py"),
    ("Two-Factor Authentication", "test_2fa.py"),
    ("Rate Limiting", "test_rate_limit.py")
]

def main():
    print("=" * 60)
    print("  Language Matrix Security Test Suite")
    print("  Target: http://localhost:3001")
    print("=" * 60)
    print()

    results = []
    
    for name, script in TESTS:
        if not os.path.exists(script):
            print(f">> Running: {name} ({script})")
            print(f"  Result: [SKIP] file not found\n")
            results.append((name, script, "[SKIP]"))
            continue
            
        print(f">> Running: {name} ({script})")
        res = subprocess.run([sys.executable, script], capture_output=True, text=True)
        if res.returncode == 0:
            print("  Result: [PASS]\n")
            results.append((name, script, "[PASS]"))
        elif res.returncode == 3:
            print("  Result: [SKIP]\n")
            results.append((name, script, "[SKIP]"))
        else:
            print("  Result: [FAIL]\n")
            results.append((name, script, "[FAIL]"))
            
    print("=" * 60)
    report_lines = [
        "# 🔐 Security Report — Language Matrix Admin Panel",
        "",
        "## Summary",
        "",
        "| Test | Script | Status |",
        "|------|--------|--------|"
    ]
    for name, script, status in results:
        report_lines.append(f"| {name} | `{script}` | {status} |")
        
    with open("../SECURITY_REPORT.md", "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines) + "\n")
        
    print("📄 Report written to SECURITY_REPORT.md")
    
    if any(st == "[FAIL]" for _, _, st in results):
        print("=" * 60)
        print("  Some tests FAILED -- review SECURITY_REPORT.md")
        print("=" * 60)
        sys.exit(1)
    else:
        print("=" * 60)
        print("  All tests PASSED! ✅")
        print("=" * 60)
        sys.exit(0)

if __name__ == "__main__":
    main()
