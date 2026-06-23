---
name: manage-jira
description: Write Acceptance Criteria and Test Cases back to Jira fields, converting markdown to ADF format.
---

# manageJira — Jira Write Skill

Skill ini menangani semua operasi **write** ke Jira: update Acceptance Criteria (AC) dan Test Cases (TC).

---

## Write Acceptance Criteria

Gunakan tool `write_jira_ac`:

- **Phase 1 (append):** `append: true` — tambahkan di bawah AC yang sudah ada
- **Refine AC (overwrite):** `append: false` — timpa seluruh AC field

Input: markdown AC yang sudah di-renumber sequentially (AC-1, AC-2, ...).

---

## Write Test Cases

Sebelum menulis TC, selalu cek dulu dengan `check_jira_tc_field`:
- Kosong → lanjut write dengan `write_jira_tc`
- Ada isinya → tanyakan user: overwrite atau cancel?

Gunakan tool `write_jira_tc` dengan full content `tc.md` sebagai input.

Format tc.md yang diharapkan:

```
### TS-01: [Title]
**Type:** Functional
**Priority:** M

**Given**
- [precondition]
**When**
- [step]
**Then**
- [outcome]

**TC:**
[+] Positive test case
[-] Negative test case
```

Output di Jira: tabel dengan kolom **Test Scenario | Type | Test Case & Evidence | Priority | Status**.

---

## Behavior

- Selalu gunakan content dari hasil generate — jangan dari chat memory.
- AC ditulis dari hasil generate-ac workflow atau hasil Refine AC.
- TC ditulis dari hasil generate-tc workflow.
- Renumber AC items (AC-1, AC-2, ...) sebelum menulis jika ada gap atau duplikat.
