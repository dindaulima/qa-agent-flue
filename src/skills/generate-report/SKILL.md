---
name: generate-report
description: Generate a test execution report by parsing QA result annotations stored in the Jira Test Case field.
---

# generateReport — Test Execution Report Skill

Skill ini membuat test report berdasarkan catatan hasil testing QA yang tersimpan di Jira.

---

## Workflow

### Step 1 — Cek Kesiapan

Fetch TC field dengan `fetch_jira_field` (`fieldName: "test_case"`).

| Kondisi | Tindakan |
|---|---|
| Field kosong | Ingatkan user: TC belum dibuat. Generate TC dulu. |
| TC ada tapi tidak ada `**Result:**` | Tampilkan report dengan semua status PENDING. Ingatkan user untuk menambahkan anotasi. |
| TC ada dan sudah dianotasi | Lanjut ke Step 2 |

### Step 2 — Parse dan Hitung Metrics

Dari TC field content, extract:
- Semua TS dan TC
- Status per TC: `**Result:**` atau emoji (✅ PASS, ❌ FAIL, 🚫 BLOCKED, ⏭ SKIP)
- Hitung: total TS, TC, passed, failed, blocked, skip, pending
- Pass rate = passed / (total − pending − skip)

### Step 3 — Generate Report

Format output:

```
# Test Execution Report — TICKET-ID

**Feature:** [judul]
**Ticket:** [URL]
**Status:** [status]
**Report Date:** [tanggal]

## Summary
| Metric | Value |
...

## Status per Test Scenario
...

## Test Case Results
...

## Issues Found
[detail TC yang FAIL atau BLOCKED]
```

---

## Status yang Valid

| Status | Alias | Keterangan |
|---|---|---|
| `PASS` | `LULUS`, ✅ | Test berhasil |
| `FAIL` | `GAGAL`, ❌ | Test gagal |
| `BLOCKED` | `BLOKIR`, 🚫 | Tidak dapat dijalankan |
| `SKIP` | ⏭ | Dilewati |
| _(tidak ada)_ | | PENDING |
