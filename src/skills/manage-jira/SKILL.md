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

Format tc.md yang diharapkan — satu blok per grup Feature (satu grup = satu baris tabel):

````
### Group 1
```gherkin
Feature: [Nama Fitur] - [Tema grup]
  Sebagai [Aktor]
  Saya ingin [goal]
  Agar [benefit]

  Background:
    Given [precondition]

  ============================================================

  Scenario: 1.1 - [+] [judul skenario positif]
    When [langkah]
    Then [hasil]

  Scenario: 1.2 - [-] [judul skenario negatif]
    When [langkah]
    Then [hasil]
```

**TC:**
[+] [judul skenario positif]
[-] [judul skenario negatif]

---
````

Output di Jira: tabel dengan kolom **Test Scenario | Evidence | Status**. Kolom Test Scenario berisi blok Gherkin (code block) per grup; kolom Evidence berisi daftar bernomor biasa (ordered list, bukan checklist) `[+]`/`[-]` — satu item per Scenario dalam grup tersebut, urutannya mengikuti urutan Scenario di blok Gherkin (nomor list 1, 2, 3, ... sudah cukup mewakili tanpa perlu menuliskan ulang nomor grup.scenario seperti 1.1/1.2).

---

## Behavior

- Selalu gunakan content dari hasil generate — jangan dari chat memory.
- AC ditulis dari hasil generate-ac workflow atau hasil Refine AC.
- TC ditulis dari hasil generate-tc workflow.
- Renumber AC items (AC-1, AC-2, ...) sebelum menulis jika ada gap atau duplikat.
