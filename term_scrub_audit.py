"""
Voyager Sanctuary term scrub audit.
Scans /lib and /docs for "garden" terminology to replace with Voyager metaphor.
Output: voyager_term_audit.txt
"""
import os

# The "Garden" terms we want to eliminate from Voyager
# CAUTION: Do not replace "seed" in Random().seed or Color.fromSeed() — those are Dart/Flutter APIs.
TARGET_TERMS = ['seed', 'garden', 'soil', 'planting', 'harvest', 'orchard', 'grow', 'bloom', 'sprout']
EXCLUDE_DIRS = ['.git', '.cursor', 'build', '.dart_tool']

# Only scan these folders (project storybook lives in lib + docs)
SCAN_DIRS = ['lib', 'docs']


def audit_terms():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    findings = []
    for scan_dir in SCAN_DIRS:
        if not os.path.isdir(scan_dir):
            continue
        for root, dirs, files in os.walk(scan_dir):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                if file.endswith(('.dart', '.md', '.yaml', '.txt')):
                    path = os.path.join(root, file)
                    try:
                        with open(path, 'r', encoding='utf-8') as f:
                            for i, line in enumerate(f, 1):
                                for term in TARGET_TERMS:
                                    if term.lower() in line.lower():
                                        findings.append(f"[{path}:{i}] Found '{term}': {line.strip()}")
                    except Exception:
                        pass

    out_path = os.path.join(script_dir, 'voyager_term_audit.txt')
    with open(out_path, 'w', encoding='utf-8') as out:
        out.write("\n".join(findings))
    print(f"Audit complete. {len(findings)} instances found in voyager_term_audit.txt")


if __name__ == "__main__":
    audit_terms()
