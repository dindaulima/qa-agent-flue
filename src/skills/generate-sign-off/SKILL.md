---
name: generate-sign-off
description: Generate a Software Testing Sign-Off document from Jira tickets (single ticket or all children under an Epic).
---

# generateSignOff — Software Testing Sign-Off Skill

Skill ini membuat dokumen **Software Testing Sign-Off** berdasarkan satu tiket Jira atau seluruh child card di bawah sebuah Epic.

---

## Urutan Kerja

1. Ambil tiket input via `fetch_jira_ticket` — pastikan `field_config_found` true
2. Tentukan tipe tiket: Epic atau bukan
   - Jika Epic → panggil `fetch_epic_children` untuk ambil semua child tickets
   - Jika bukan Epic → gunakan tiket itu sendiri
3. Filter tickets: abaikan status **Cancelled / Canceled / Backlog**, dan tickets yang tidak punya konten `test_case`
4. Hitung metrics dari setiap ticket
5. Extract known issues dan QA notes
6. Buat dokumen sign-off sesuai template di bawah

---

## Template Dokumen

```
# SOFTWARE TESTING SIGN-OFF DOCUMENT

---

## Summary

### Project Details

| Field | Detail |
|---|---|
| Product Name |  |
| Release No. |  |
| Test Period | [first QA update] - [last QA update] |
| Checkpoint / Review |  |
| Deploy Date | |
| Product Owner / Product Manager | |
| Technical Lead | |
| Developer | [assignee dari Jira] |
| QA | [QA person dari Jira] |

### Key Metrics

| Metric | Count |
|---|---|
| Total Scenario | [jumlah TS dari semua tickets] |
| Total Test Case | [jumlah TC dari semua tickets] |
| Passed Test Case | [jumlah TC passed] |
| Failed Test Case | [jumlah TC failed] |

### Status

**Overall:** [Approved / Approved with Known Issues / Not Approved]

**Known Issues:** [jumlah known issues] Critical Issues

---

## Test Coverage

| Field | Detail |
|---|---|
| Browser Tested | Chrome (latest stable version, Windows 10 Pro) |
| Devices Tested | Desktop only |
| Test Type | Functional, UI |
| Instances Tested | |

---

## Test Artifacts

### Scope Testing

| Scope | Accommodated? |
|---|---|
| [highlight fitur/AC 1] | ✔ or x |
| [highlight fitur/AC 2] | ✔ or x |

### Test Cases / Checklist / Test Run

| Summary | Source |
|---|---|
| [summary singkat & jelas tiket 1] | [URL tiket 1] |
| [summary singkat & jelas tiket 2] | [URL tiket 2] |

### Known Issues and QA's Notes

- [catatan 1 dari QA]
- [catatan 2 dari QA]
```

---

## Aturan per Bagian

### Project Details
- **Product Name, Release No., Checkpoint/Review, Deploy Date, Product Owner/PM, Technical Lead**: kosongkan (biarkan blank)
- **Test Period**: inferensikan dari kapan QA pertama dan terakhir update tiket. Jika tidak bisa ditentukan dari data yang tersedia, kosongkan.
- **Developer**: ambil dari field `assignee` Jira
- **QA**: ambil dari `qa_feedback`, komentar, atau nama yang muncul di catatan QA. Jika tidak ada, kosongkan.

### Key Metrics
- **Total Scenario**: jumlah `Scenario:` (di dalam blok Gherkin kolom Test Scenario) dari semua tickets — SATU baris tabel bisa berisi beberapa Scenario karena dikelompokkan per grup Feature, jadi jangan hitung baris tabel
- **Total Test Case**: jumlah item bernomor (ordered list) berisi tag `[+]` atau `[-]` di kolom Evidence dari semua tickets
- **Passed Test Case**:
  - Jika status kolom **Status** pada baris TS = "passed" (case-insensitive) → semua TC di baris tersebut dihitung passed
  - Jika status bukan "passed" dan tidak ada anotasi manual eksplisit per item (misal ditandai PASSED/FAILED oleh QA) → TC pada baris tersebut dihitung belum passed (0)
- **Failed Test Case** = Total TC − Passed TC
- **Overall Status**:
  - Semua TC passed → "Approved"
  - Ada TC failed tapi tetap bisa release → "Approved with Known Issues"
  - Ada blokir signifikan → "Not Approved"

### Test Coverage
- **Browser Tested**: Chrome versi stabil terbaru (Windows 10 Pro) — isi versi terkini yang kamu ketahui
- **Devices Tested**: Desktop only
- **Test Type**: Functional, UI
- **Instances Tested**: kosongkan

### Scope Testing
- Highlight perubahan fitur utama dari `description` dan `acceptance_criteria`
- Maksimal 3–4 highlight per ticket, jangan terlalu granular
- Kolom "Accommodated?": `✔` jika tercakup di TS/TC, `x` jika tidak (karena out-of-scope, bug yang belum fix, dll.)
- Catatan testing yang belum terakomodir cukup ditandai `x` di sini — detail masuk ke Known Issues

### Test Cases / Checklist / Test Run
- Satu baris per ticket Jira (tidak ada duplikasi)
- **Summary**: ringkasan tugas/fitur yang jelas dan singkat. Boleh menggunakan summary Jira secara langsung, atau paraphrase jika summary Jira bertele-tele atau tidak jelas
- **Source**: URL tiket Jira

### Known Issues and QA's Notes
- Ambil dari konten `acceptance_criteria`, `test_case`, atau `qa_feedback` yang mengandung:
  - Icon tanda seru ⚠️ atau ❗
  - Keyword: "Catatan", "Note", "Notes", "Known Issue", "Known Issues", "QA Note"
- Tulis setiap catatan sebagai bullet point
- Jika catatannya kritis (blokir atau bug signifikan), tulis dengan **bold**
- Jika ada workaround, tuliskan sebagai sub-bullet

---

## Bahasa Dokumen

Gunakan **Bahasa Indonesia** untuk seluruh teks naratif dan deskripsi di dokumen sign-off.
Pertahankan terminologi QA/teknis dalam Bahasa Inggris karena sudah lazim digunakan, misalnya: Test Case, Test Scenario, Sign-Off, Passed, Failed, Happy Path, Edge Case, Known Issues, Browser, Desktop, Functional, UI.
