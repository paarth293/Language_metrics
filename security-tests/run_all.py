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
    port = "3001"
    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg in ("--port", "-p") and i + 1 < len(args):
            port = args[i + 1]
        elif arg.startswith("--port="):
            port = arg.split("=", 1)[1]

    os.environ["PORT"] = port
    target = f"http://localhost:{port}"

    print("=" * 60)
    print("  Language Matrix Security Test Suite")
    print(f"  Target: {target}")
    print("=" * 60)
    print()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    results = []

    for name, script in TESTS:
        script_path = os.path.join(base_dir, script)
        if not os.path.exists(script_path):
            print(f">> Running: {name} ({script})")
            print(f"  Result: [SKIP] file not found\n")
            results.append((name, script, "[SKIP]"))
            continue

        if os.path.getsize(script_path) == 0:
            print(f">> Running: {name} ({script})")
            print(f"  Result: [NOT IMPLEMENTED] file exists but is empty — no test was actually run\n")
            results.append((name, script, "[NOT IMPLEMENTED]"))
            continue

        print(f">> Running: {name} ({script})")
        res = subprocess.run([sys.executable, script_path], capture_output=True, text=True)
        if res.returncode == 0:
            print("  Result: [PASS]\n")
            results.append((name, script, "[PASS]"))
        elif res.returncode == 3:
            print("  Result: [SKIP]")
            if res.stdout:
                for line in res.stdout.strip().splitlines():
                    print(f"    {line}")
            print()
            results.append((name, script, "[SKIP]"))
        else:
            print("  Result: [FAIL]")
            if res.stdout:
                for line in res.stdout.strip().splitlines():
                    print(f"    {line}")
            if res.stderr:
                for line in res.stderr.strip().splitlines():
                    print(f"    {line}")
            print()
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
        
    report_path = os.path.join(base_dir, "..", "SECURITY_REPORT.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines) + "\n")
        
    print("Report written to SECURITY_REPORT.md")
    
    not_implemented = [n for n, _, st in results if st == "[NOT IMPLEMENTED]"]

    if any(st == "[FAIL]" for _, _, st in results):
        print("=" * 60)
        print("  Some tests FAILED -- review SECURITY_REPORT.md")
        print("=" * 60)
        sys.exit(1)
    elif not_implemented:
        print("=" * 60)
        print("  Suite ran, but these checks have NO test code yet and were")
        print("  NOT actually verified — do not read this as a clean bill of")
        print("  health for them:")
        for n in not_implemented:
            print(f"    - {n}")
        print("=" * 60)
        sys.exit(2)
    else:
        print("=" * 60)
        print("  All tests PASSED! [OK]")
        print("=" * 60)
        sys.exit(0)

if __name__ == "__main__":
    main()
