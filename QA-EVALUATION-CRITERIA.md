# Kriteria Evaluasi QA

Dokumen ini menjelaskan bagaimana workflow `evaluate-qa` ([src/workflows/evaluate-qa.ts](src/workflows/evaluate-qa.ts)) menilai kualitas artefak QA dari sebuah tiket Jira: **Task Feasibility** (description tiket), **Acceptance Criteria (AC)**, **Test Scenario (TS)**, dan **Test Case (TC)**. Rubrik detail didefinisikan di [src/skills/qa-evaluator/SKILL.md](src/skills/qa-evaluator/SKILL.md), dan perhitungan skor akhir ada di [src/tools/scoring-tools.ts](src/tools/scoring-tools.ts).

## Alur Evaluasi

Evaluasi dijalankan dalam 4 tahap berurutan dalam satu session (supaya tidak timeout untuk tiket besar):

1. **Task Feasibility** — ambil tiket, nilai kualitas description, ekstrak scope (in scope / out of scope).
2. **Acceptance Criteria** — nilai field `acceptance_criteria`.
3. **Test Scenario** — nilai kolom "Test Scenario" di field `test_case`.
4. **Test Case** — nilai kolom "Test Case & Evidence" di field `test_case`, lalu hitung skor akhir + gap analysis + rekomendasi.

**Aturan dasar:** jika field terkait kosong/null, semua sub-kriteria kategori itu diberi skor **0**.

## Evaluasi Berbasis Scope

Sebelum menilai coverage, agent mengidentifikasi:
- **In scope** — hal yang eksplisit wajib diuji/diimplementasikan.
- **Out of scope** — hal yang eksplisit dikecualikan (frasa seperti "tidak termasuk", "out of scope", "belum termasuk di sprint ini", dll).

Item **out of scope** yang tidak punya TS/TC **tidak boleh menurunkan skor** — absennya itu benar, bukan gap.

**Prioritas AC QA vs description:** jika field `acceptance_criteria` (AC QA) sudah diisi, itu jadi sumber utama gambaran scope aktual. Jika AC QA jauh lebih luas dari description (mis. description cuma sebut 1 kasus tapi AC QA mencakup arsitektur/UI baru/business rules lain), ini jadi bukti description *underspecified* → menurunkan skor `completeness`, `business_rules`, `actionability`, `scope_boundary`.

---

## 1. Task Feasibility

Menilai kualitas description tiket — apakah cukup jelas untuk mulai dikerjakan.

| Sub-kriteria | Bobot | Menilai apa |
|---|---|---|
| `expected_result` | 20% | Goals & expected output ditulis jelas dan terukur |
| `business_rules` | 20% | Business rules/constraint tertulis eksplisit |
| `clarity` | 20% | Bebas ambiguitas, bisa dipahami tanpa bertanya |
| `completeness` | 15% | Ada context, user story, ekspektasi, business rules, scope |
| `actionability` | 15% | QA/Dev bisa langsung kerja tanpa klarifikasi |
| `scope_boundary` | 10% | In-scope & out-of-scope jelas |

Contoh anchor skor (`expected_result`):

| Skor | Kondisi |
|---|---|
| 90–100 | Goals eksplisit, expected output terukur, jobs-to-be-done spesifik |
| 70–89 | Goals jelas, expected output masih umum |
| 50–69 | Goals bisa dipahami tapi butuh inferensi |
| 30–49 | Goals sangat umum ("improve", "fix") tanpa detail |
| 0–29 | Tidak ada pernyataan goals sama sekali |

Anchor lengkap untuk keenam sub-kriteria (masing-masing 5 tingkat skor) ada di SKILL.md bagian "Kriteria Task Feasibility".

**Verdict:**

| Task Feasibility Score | Verdict | Makna |
|---|---|---|
| ≥ 70 | LAYAK | Task layak dikerjakan |
| 50–69 | PERLU_REVISI | Perlu klarifikasi sebelum dikerjakan |
| < 50 | TIDAK_LAYAK | Tidak cukup jelas untuk dikerjakan |

---

## 2. Acceptance Criteria (AC)

| Sub-kriteria | Bobot | Menilai apa |
|---|---|---|
| `validity` | 20% | AC berisi aturan/kondisi ("sistem harus..."), bukan cuma deskripsi fitur |
| `behavioral_clarity` | 20% | Perilaku sistem observable (bukan sudut pandang user) |
| `testability` | 25% | Bisa diverifikasi pass/fail tanpa interpretasi subjektif |
| `non_ambiguity` | 15% | Bebas kata abu-abu tanpa definisi jelas |
| `business_alignment` | 15% | Mencakup business rules dari PM, bukan cuma teknikal |
| `dependency_awareness` | 5% | Mencakup cara handle integrasi sistem lain (default 80 jika tidak relevan) |

Jika field `acceptance_criteria` kosong → semua sub-kriteria = 0.

---

## 3. Test Scenario (TS)

Dibaca dari kolom **Test Scenario** pada field `test_case`.

| Sub-kriteria | Bobot | Menilai apa |
|---|---|---|
| `journey_based` | 15% | Ditulis dari POV user, format Given/When/Then |
| `real_world_relevance` | 20% | Mencerminkan perilaku user sebenarnya |
| `crucial_paths_covered` | 30% | Mencakup user journey terpenting (jobs-to-be-done) |
| `full_coverage` | 25% | Mencakup kondisi normal DAN tidak normal (error, edge case) |
| `prioritization` | 10% | Prioritas MoSCoW masuk akal, minimal 1 Must Have |

Evaluasi `crucial_paths_covered` & `full_coverage` hanya berdasarkan item **in scope**.

---

## 4. Test Case (TC)

Dibaca dari kolom **Test Case & Evidence** pada field `test_case`. Ini kategori dengan bobot terbesar di skor akhir (40%).

| Sub-kriteria | Bobot | Menilai apa |
|---|---|---|
| `functional` | 25% | Fungsionalitas utama dari AC tercakup dengan expected result spesifik |
| `visual_ui` | 10% | Layout, responsiveness, typography, component states (default 80 jika tidak ada UI) |
| `flow_ux` | 15% | End-to-end journey, interaksi dengan fitur/data lain |
| `security` | 20% | Autentikasi, otorisasi, percobaan pelanggaran keamanan |
| `edge_cases` | 10% | Nilai batas input, kasus anomali jarang terjadi |
| `data_validation` | 10% | Required fields, format, tipe data, expected output |
| `anomaly_negative` | 10% | Input tak terduga, alur terputus, race condition |

---

## Formula Skor Akhir

```
Task Feasibility Score = Σ (skor sub-kriteria × bobot)
AC Score  = Σ (skor sub-kriteria AC × bobot)
TS Score  = Σ (skor sub-kriteria TS × bobot)
TC Score  = Σ (skor sub-kriteria TC × bobot)

QA Quality Score = (AC Score × 30%) + (TS Score × 30%) + (TC Score × 40%)
```

Dihitung oleh tool `calculate_qa_score` ([src/tools/scoring-tools.ts](src/tools/scoring-tools.ts)), bukan oleh model — bobot di atas fixed di kode.

**Verdict QA Quality Score:**

| Skor | Verdict | Makna |
|---|---|---|
| ≥ 80 | BAIK | Kualitas kerja QA baik |
| 60–79 | CUKUP | Cukup, ada ruang perbaikan |
| < 60 | PERLU_PERBAIKAN | Perlu perbaikan signifikan |

---

## Gap Analysis

Setiap evaluasi juga menghasilkan 4 gap konkrit (poin spesifik, bukan pernyataan umum):

1. **gapDescToAc** — requirement di description yang belum ada AC-nya (satu arah: desc → AC).
2. **gapAcQaToDesc** — aspek di AC QA yang sama sekali tidak disebut di description → indikasi description underspecified/terlalu sempit dibanding scope aktual.
3. **gapAcToTs** — AC yang tidak punya TS.
4. **gapTsToTc** — TS yang tidak punya TC.

Semua gap analysis mengikuti aturan scope: item **out of scope** tidak dianggap sebagai gap.

## Output Akhir

Workflow mengembalikan: ringkasan & URL tiket, scope context, skor + verdict Task Feasibility dan QA Quality, rationale tiap kategori, 4 gap di atas, dan daftar rekomendasi actionable.
