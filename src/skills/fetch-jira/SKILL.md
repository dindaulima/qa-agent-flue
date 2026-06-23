---
name: fetch-jira
description: Fetch a Jira ticket and extract all fields relevant for QA analysis (description, AC, TC, comments, linked tickets).
---

# fetchJira — Fetch Jira Ticket Skill

Skill ini mengambil data tiket Jira beserta semua field yang relevan untuk analisis QA.
Dipanggil di awal setiap fase (Phase 1, Refine AC, Phase 2) sebelum analisis atau generate artefak.

---

## Cara Menggunakan

Panggil tool `fetch_jira_ticket` dengan ticketId yang diberikan user.

Jika project belum punya field mapping, panggil `discover_jira_fields` terlebih dahulu, lalu ulangi `fetch_jira_ticket`.

---

## Data yang Dikembalikan

| Field | Keterangan |
|---|---|
| `key` | ID tiket (e.g. PROJ-123) |
| `summary` | Judul tiket |
| `description` | Deskripsi / requirements dari PM |
| `acceptance_criteria` | AC yang sudah ada (QA field) — null jika field belum dikonfigurasi |
| `test_case` | Isi field Test Case — cek apakah sudah ada konten |
| `linked_tickets` | Tiket yang terhubung |
| `subtasks` | Daftar sub-task |
| `comments` | Komentar yang relevan |
| `field_config_found` | true jika project sudah dikonfigurasi |

---

## Cara Membaca Output

Setelah fetch, pisahkan dua sumber:

- **`description`** — konten dari PM: requirements, konteks bisnis, AC versi PM (jika ada)
- **`acceptance_criteria`** — AC yang ditulis oleh QA di field dedicated

Jangan gabungkan keduanya. Keduanya dianalisis secara terpisah di Layer B (AC Source Conditions).

Jika `field_config_found` adalah false → panggil `discover_jira_fields` untuk setup project.
