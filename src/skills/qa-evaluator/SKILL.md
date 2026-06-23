---
name: qa-evaluator
description: Evaluate the quality of QA artifacts (AC, TS, TC) from a Jira ticket using weighted scoring criteria. Produces Task Feasibility Score and QA Quality Score.
---

# qaEvaluator — QA Artifact Evaluation Skill

Skill ini mengevaluasi kualitas artefak QA (AC, TS, TC) dari tiket Jira berdasarkan rubrik penilaian terstandarisasi.

---

## Urutan Kerja

1. Ambil tiket via `fetch_jira_ticket` — pastikan `field_config_found` true
2. Periksa apakah field `acceptance_criteria` dan `test_case` memiliki konten
3. **Identifikasi scope** dari AC dan description sebelum mengevaluasi coverage
4. Evaluasi setiap sub-kriteria → beri skor 0–100 menggunakan anchor di bawah
5. Panggil `calculate_qa_score` untuk mendapatkan skor tertimbang final
6. Analisis gap: Desc→AC, AC→TS, TS→TC
7. Buat rekomendasi konkrit berdasarkan temuan

**Penting:** Jika field kosong (null / empty), beri skor **0** untuk semua sub-kriteria kategori tersebut.

---

## Evaluasi Berbasis Scope

Sebelum mengevaluasi coverage, identifikasi scope dari AC atau description:

- **In scope**: Hal-hal yang secara eksplisit disebutkan wajib diuji atau diimplementasikan
- **Out of scope**: Hal-hal yang secara eksplisit dikecualikan, tidak diwajibkan, atau ditandai sebagai pengecualian (frasa seperti "tidak termasuk", "dikecualikan", "out of scope", "not in scope", "tidak perlu", "belum termasuk di sprint ini", dll.)

**Aturan penilaian berbasis scope:**
- Evaluasi coverage (`crucial_paths_covered`, `full_coverage`, `functional`, `edge_cases`, `security`, `visual_ui`, `flow_ux`, dll.) hanya berdasarkan item yang **in scope**
- Item yang **out of scope** — jika tidak ada di TS atau TC — **TIDAK boleh menurunkan skor**
- Jika AC atau description secara eksplisit mengecualikan suatu skenario, absennya skenario tersebut di TS/TC adalah benar dan tidak perlu direkomendasikan sebagai gap
- Gap analysis juga harus memperhitungkan scope: jangan sebut item out-of-scope sebagai "missing coverage"

---

## Kriteria Task Feasibility

### expected_result (bobot 20%)
Apakah goals task dan ekspektasi output fitur tertulis jelas?

| Skor | Kondisi |
|---|---|
| 90–100 | Goals ditulis eksplisit, ada expected output/outcome yang terukur, dan menjelaskan jobs-to-be-done user secara spesifik |
| 70–89 | Goals jelas tapi expected output masih umum, atau ada 1 aspek yang belum dideskripsikan |
| 50–69 | Goals bisa dipahami tapi butuh inferensi; tidak ada expected output tertulis |
| 30–49 | Goals sangat umum ("improve", "fix", "enhance") tanpa penjelasan konkret |
| 0–29 | Tidak ada pernyataan goals sama sekali, atau hanya judul tiket |

### business_rules (bobot 20%)
Apakah business rules atau constraint bisnis tertulis dengan jelas?

| Skor | Kondisi |
|---|---|
| 90–100 | Semua business rules ditulis eksplisit sebagai kondisi/aturan terverifikasi (≥3 rules untuk fitur non-trivial) |
| 70–89 | Business rules ada tapi 1–2 rules tersirat atau tidak lengkap |
| 50–69 | Hanya 1 business rule yang eksplisit; sisanya harus diinterpretasi dari konteks |
| 30–49 | Business rules tidak ditulis; hanya ada deskripsi fitur tanpa aturan |
| 0–29 | Tidak ada informasi business rules sama sekali |

### clarity (bobot 20%)
Apakah deskripsi bebas ambiguitas dan bisa dipahami semua pembaca tanpa bertanya?

| Skor | Kondisi |
|---|---|
| 90–100 | Tidak ada kata ambigu; istilah teknis atau bisnis yang khusus sudah didefinisikan |
| 70–89 | Satu istilah atau kalimat masih ambigu tapi tidak menghalangi pemahaman utama |
| 50–69 | 2–3 bagian ambigu yang membutuhkan asumsi untuk dipahami |
| 30–49 | Banyak bagian ambigu; pembaca perlu bertanya untuk memahami separuh konten |
| 0–29 | Terlalu ambigu untuk dipahami tanpa klarifikasi langsung ke penulis |

### completeness (bobot 15%)
Apakah tiket menyertakan: context/latar, user story, ekspektasi, business rules, dan scope?

| Skor | Kondisi |
|---|---|
| 90–100 | Semua 5 elemen hadir: context, user story, ekspektasi, business rules, scope |
| 70–89 | 4 dari 5 elemen hadir |
| 50–69 | 3 dari 5 elemen hadir |
| 30–49 | 2 dari 5 elemen hadir |
| 0–29 | Hanya 1 elemen atau tidak ada elemen sama sekali |

### actionability (bobot 15%)
Apakah QA dan Dev bisa langsung mulai kerja setelah membaca deskripsi, tanpa bertanya?

| Skor | Kondisi |
|---|---|
| 90–100 | Dev bisa langsung coding dan QA bisa langsung membuat test plan tanpa pertanyaan |
| 70–89 | Ada 1 hal yang perlu dikonfirmasi sebelum mulai, tapi pekerjaan bisa dimulai sebagian |
| 50–69 | Perlu 2–3 klarifikasi; pekerjaan tidak bisa dimulai sebelum ada jawaban |
| 30–49 | Terlalu banyak yang perlu dikonfirmasi; tidak jelas dari mana mulai |
| 0–29 | Tidak bisa mulai sama sekali tanpa sesi klarifikasi penuh dengan stakeholder |

### scope_boundary (bobot 10%)
Apakah jelas mana yang in-scope dan out-of-scope?

| Skor | Kondisi |
|---|---|
| 90–100 | In-scope dan out-of-scope ditulis eksplisit, atau scope sangat sempit sehingga tidak perlu ditulis |
| 70–89 | In-scope jelas tapi out-of-scope tidak disebutkan, atau ada 1 area abu-abu |
| 50–69 | Scope harus diinferensikan dari deskripsi; tidak ditulis eksplisit |
| 30–49 | Scope tidak jelas; mudah terjadi misinterpretasi yang signifikan |
| 0–29 | Tidak ada informasi scope sama sekali |

---

## Kriteria AC

### validity (bobot 20%)
Apakah AC berisi aturan/kondisi yang harus dipenuhi sistem, bukan hanya deskripsi fitur?

| Skor | Kondisi |
|---|---|
| 90–100 | Semua AC ditulis sebagai kondisi verifiable ("sistem harus...", "jika X maka Y"); tidak ada AC yang hanya mendeskripsikan fitur |
| 70–89 | Sebagian besar AC valid; 1–2 AC masih berbentuk deskripsi fitur |
| 50–69 | Campuran; sekitar setengah AC adalah aturan, setengah lagi deskripsi |
| 30–49 | Kebanyakan AC adalah deskripsi fitur, bukan aturan yang harus dipenuhi |
| 0–29 | AC tidak berisi aturan sama sekali, atau isinya hanya pengulangan deskripsi tiket |

### behavioral_clarity (bobot 20%)
Apakah AC mendeskripsikan perilaku sistem yang bisa diamati (output data, tampilan, atau respons sistem)?

| Skor | Kondisi |
|---|---|
| 90–100 | Setiap AC menjelaskan apa yang dilakukan sistem secara observable (bukan "user bisa melakukan X" tapi "sistem menampilkan/menyimpan/mengembalikan Y") |
| 70–89 | Sebagian besar AC observable; 1–2 AC masih dari sudut pandang user tanpa menyebut perilaku sistem |
| 50–69 | Sekitar setengah AC observable; setengah lagi ambigu dari sisi sistem vs user |
| 30–49 | AC kebanyakan dari sudut pandang user ("user bisa...") tanpa menyebut perilaku sistem |
| 0–29 | Tidak ada AC yang menjelaskan perilaku sistem yang bisa diamati |

### testability (bobot 25%)
Apakah AC bisa diverifikasi melalui pengujian tanpa interpretasi subjektif?

| Skor | Kondisi |
|---|---|
| 90–100 | Semua AC bisa diuji dengan pass/fail yang jelas; tidak ada kata ambigu seperti "cepat", "sesuai", "user friendly" |
| 70–89 | Sebagian besar AC testable; 1–2 AC mengandung kata ambigu tapi masih bisa diinterpretasi |
| 50–69 | Beberapa AC testable tapi ≥1 AC kritis mengandung kata ambigu yang menyulitkan pengujian |
| 30–49 | Banyak AC mengandung kata subjektif; sulit membuat test case yang objektif |
| 0–29 | AC tidak bisa diuji secara objektif; semua AC mengandung kata subjektif atau tidak terukur |

### non_ambiguity (bobot 15%)
Apakah AC bebas dari kata abu-abu tanpa definisi yang jelas?

| Skor | Kondisi |
|---|---|
| 90–100 | Tidak ada kata ambigu. Semua istilah teknis dan bisnis didefinisikan atau konteksnya jelas |
| 70–89 | 1 kata ambigu ditemukan tapi tidak kritis terhadap hasil pengujian |
| 50–69 | 2–3 kata ambigu yang cukup mempengaruhi hasil pengujian |
| 30–49 | >3 kata ambigu yang secara langsung membuat hasil test berbeda antar penguji |
| 0–29 | Hampir semua AC mengandung kata ambigu; tidak ada konsensus cara mengujinya |

### business_alignment (bobot 15%)
Apakah AC mencakup business rules dari perspektif bisnis/PM, bukan hanya aspek teknikal?

| Skor | Kondisi |
|---|---|
| 90–100 | AC mencakup semua business rules dari deskripsi tiket, termasuk kondisi bisnis dan edge case bisnis |
| 70–89 | Sebagian besar business rules tercakup; 1 rule bisnis dari deskripsi tidak ada AC-nya |
| 50–69 | Hanya rules teknikal yang tercakup; rules bisnis dari deskripsi tidak direpresentasikan di AC |
| 30–49 | AC hanya mencakup happy path dari perspektif teknikal; tidak ada perspektif bisnis |
| 0–29 | AC tidak berkaitan dengan business rules di deskripsi tiket |

### dependency_awareness (bobot 5%)
Apakah AC mencakup cara sistem menangani integrasi dengan sistem lain?

| Skor | Kondisi |
|---|---|
| 90–100 | Semua integrasi dengan sistem lain (API, DB, service) disebutkan dan cara penanganannya jelas |
| 70–89 | Integrasi disebutkan tapi cara penanganan error atau edge case integrasi tidak ditulis |
| 50–69 | Hanya 1 integrasi yang disebutkan padahal fitur berinteraksi dengan >1 sistem |
| 30–49 | Tidak ada AC untuk integrasi meskipun fitur jelas berinteraksi dengan sistem lain |
| 0–29 | Tidak relevan (fitur berdiri sendiri) → beri skor 80 sebagai default |

---

## Kriteria TS

### journey_based (bobot 15%)
Apakah TS ditulis dari sudut pandang user dengan format Given/When/Then atau setara?

| Skor | Kondisi |
|---|---|
| 90–100 | Semua TS menggunakan Given/When/Then yang lengkap dan konteksnya realistis sebagai aksi user |
| 70–89 | Sebagian besar TS memakai Given/When/Then; 1–2 TS formatnya tidak konsisten |
| 50–69 | Format Given/When/Then dipakai tapi isinya dari perspektif sistem, bukan user |
| 30–49 | TS tidak memakai format user journey; ditulis sebagai langkah teknikal |
| 0–29 | Tidak ada elemen format journey; TS hanya berupa judul tanpa konteks |

### real_world_relevance (bobot 20%)
Apakah skenario mencerminkan bagaimana user sebenarnya menggunakan fitur?

| Skor | Kondisi |
|---|---|
| 90–100 | Semua TS mencerminkan situasi nyata yang akan dilakukan user; tidak ada skenario yang hanya ada di "test environment" |
| 70–89 | Sebagian besar realistis; 1 skenario terasa artificial atau hanya untuk coverage |
| 50–69 | Setengah TS realistis, setengah lagi terlalu teknikal atau artificial |
| 30–49 | Kebanyakan TS tidak mencerminkan perilaku user nyata |
| 0–29 | Semua TS terasa seperti langkah teknikal, bukan skenario user |

### crucial_paths_covered (bobot 30%)
Apakah TS mencakup user journey paling penting sesuai jobs-to-be-done?

| Skor | Kondisi |
|---|---|
| 90–100 | Semua critical path dari jobs-to-be-done tercakup; tidak ada jalur penting yang hilang |
| 70–89 | Critical path utama tercakup; 1 jalur penting sekunder tidak ada TS-nya |
| 50–69 | Happy path utama ada, tapi ≥1 critical path yang sering terjadi tidak tercakup |
| 30–49 | Hanya sebagian happy path yang ada; critical path dengan business impact tinggi tidak tercakup |
| 0–29 | Critical path tidak tercakup sama sekali; TS hanya mencakup kasus trivial |

### full_coverage (bobot 25%)
Apakah TS mencakup skenario normal DAN tidak normal (gagal, error, edge case)?

| Skor | Kondisi |
|---|---|
| 90–100 | Ada TS untuk: happy path, kondisi gagal/error, input tidak valid, dan kondisi boundary |
| 70–89 | Happy path dan 1 kondisi negatif ada; tapi boundary atau error handling tidak tercakup |
| 50–69 | Hanya happy path dan 1 kondisi negatif; tidak ada coverage untuk error handling |
| 30–49 | Hanya happy path; tidak ada skenario negatif sama sekali |
| 0–29 | Coverage minimal; bahkan happy path tidak lengkap |

### prioritization (bobot 10%)
Apakah prioritas MoSCoW masuk akal dan ada minimal 1 TS bertanda Must Have?

| Skor | Kondisi |
|---|---|
| 90–100 | Semua TS punya prioritas; critical path = Must Have; edge case = Could Have; distribusi masuk akal |
| 70–89 | Prioritas ada tapi 1–2 TS prioritasnya tidak tepat (misal: critical path diberi Should Have) |
| 50–69 | Prioritas ada tapi tidak konsisten atau semua diberi Must Have tanpa diskriminasi |
| 30–49 | Prioritas tidak ada atau hanya sebagian TS yang diberi prioritas |
| 0–29 | Tidak ada prioritas sama sekali |

---

## Kriteria TC

### functional (bobot 25%)
Apakah TC mencakup verifikasi fungsionalitas utama fitur?

| Skor | Kondisi |
|---|---|
| 90–100 | Semua fungsionalitas utama dari AC tercakup dalam TC dengan expected result yang spesifik |
| 70–89 | Fungsionalitas utama tercakup; 1 AC tidak punya TC-nya |
| 50–69 | Lebih dari 1 AC tidak punya TC; atau TC ada tapi expected result terlalu umum |
| 30–49 | Kurang dari 50% AC memiliki TC yang memverifikasinya |
| 0–29 | TC tidak memverifikasi fungsionalitas utama; atau TC tidak ada |

### visual_ui (bobot 10%)
Apakah TC mencakup pengujian layout, responsiveness, typography, dan component states?

| Skor | Kondisi |
|---|---|
| 90–100 | Ada TC untuk: tampilan normal, empty state, loading state, error state, dan responsiveness |
| 70–89 | 3–4 dari 5 aspek UI tercakup |
| 50–69 | Hanya 1–2 aspek UI yang diuji (misal hanya tampilan normal) |
| 30–49 | TC UI ada tapi hanya berupa "tampilan sesuai design" tanpa detail state |
| 0–29 | Tidak ada TC untuk aspek visual/UI; atau fitur tidak punya UI (beri skor 80 sebagai default) |

### flow_ux (bobot 15%)
Apakah TC mencakup end-to-end journey dan interaksi dengan fitur/data dari modul lain?

| Skor | Kondisi |
|---|---|
| 90–100 | Ada TC yang menguji alur dari entry point sampai exit point, termasuk data yang masuk dari/keluar ke fitur lain |
| 70–89 | Alur end-to-end ada tapi interaksi dengan fitur lain tidak diuji |
| 50–69 | TC hanya menguji fitur secara isolated; tidak ada TC yang melibatkan flow antar fitur |
| 30–49 | TC hanya menguji 1 langkah dalam alur; tidak ada perspektif end-to-end |
| 0–29 | Tidak ada TC yang mencakup flow; semuanya adalah unit check terisolasi |

### security (bobot 20%)
Apakah TC mencakup pengujian autentikasi, otorisasi, dan percobaan melanggar keamanan?

| Skor | Kondisi |
|---|---|
| 90–100 | Ada TC untuk: akses tanpa login, akses dengan role yang salah, manipulasi data via URL/API, dan input berbahaya (XSS/injection) |
| 70–89 | Autentikasi dan otorisasi diuji; tapi tidak ada TC untuk manipulasi atau input berbahaya |
| 50–69 | Hanya autentikasi yang diuji; otorisasi per role tidak diuji |
| 30–49 | TC keamanan ada tapi hanya "user harus login"; tidak ada pengujian otorisasi |
| 0–29 | Tidak ada TC keamanan sama sekali |

### edge_cases (bobot 10%)
Apakah TC mencakup nilai batas input dan kasus anomali yang jarang terjadi?

| Skor | Kondisi |
|---|---|
| 90–100 | Ada TC untuk: nilai minimum, nilai maksimum, nilai tepat di batas, dan kasus yang sangat jarang terjadi |
| 70–89 | Nilai batas ada (min/max) tapi kasus anomali tidak tercakup |
| 50–69 | Hanya 1 nilai batas yang diuji; tidak ada kasus anomali |
| 30–49 | Tidak ada pengujian nilai batas; hanya input normal |
| 0–29 | Tidak ada edge case sama sekali |

### data_validation (bobot 10%)
Apakah TC mencakup validasi: required fields, format, tipe data, dan expected output data?

| Skor | Kondisi |
|---|---|
| 90–100 | Ada TC untuk: field wajib kosong, format salah, tipe data salah, dan verifikasi output data yang tersimpan/ditampilkan |
| 70–89 | Required fields dan format diuji; tapi output data tidak diverifikasi |
| 50–69 | Hanya required fields yang diuji; format dan tipe data tidak diuji |
| 30–49 | Validasi ada tapi hanya "input tidak boleh kosong" tanpa format/tipe |
| 0–29 | Tidak ada TC data validation sama sekali |

### anomaly_negative (bobot 10%)
Apakah TC mencakup input tidak terduga, alur yang terputus, dan kondisi race condition?

| Skor | Kondisi |
|---|---|
| 90–100 | Ada TC untuk: submit form 2x berturut-turut, koneksi terputus di tengah proses, input karakter khusus, dan akses bersamaan |
| 70–89 | Sebagian kondisi negatif diuji; race condition atau koneksi terputus tidak tercakup |
| 50–69 | Hanya 1 kondisi negatif (biasanya submit kosong); tidak ada yang lain |
| 30–49 | TC negatif ada tapi hanya duplikasi dari yang sudah ada di functional |
| 0–29 | Tidak ada TC untuk kondisi anomali atau negatif |

---

## Formula Skor Final

```
Task Feasibility Score = Σ (skor sub-kriteria × bobot)

AC Score  = Σ (skor sub-kriteria AC × bobot)
TS Score  = Σ (skor sub-kriteria TS × bobot)
TC Score  = Σ (skor sub-kriteria TC × bobot)

QA Quality Score = (AC Score × 30%) + (TS Score × 30%) + (TC Score × 40%)
```

### Interpretasi Task Feasibility Score

| Skor | Verdict | Makna |
|---|---|---|
| ≥ 70 | LAYAK | Task ini layak dikerjakan |
| 50–69 | PERLU_REVISI | Task perlu klarifikasi sebelum dikerjakan |
| < 50 | TIDAK_LAYAK | Task tidak cukup jelas untuk dikerjakan |

### Interpretasi QA Quality Score

| Skor | Verdict | Makna |
|---|---|---|
| ≥ 80 | BAIK | Kualitas kerja QA baik |
| 60–79 | CUKUP | Kualitas kerja QA cukup, ada ruang perbaikan |
| < 60 | PERLU_PERBAIKAN | Kualitas kerja QA perlu perbaikan signifikan |

---

## Gap Analysis

Setelah skoring, identifikasi gap secara konkrit (sebutkan poin spesifik, bukan pernyataan umum):

1. **Gap Desc → AC**: Poin dari Description yang tidak tercover di AC? AC yang seharusnya ada tapi tidak ada?
2. **Gap AC QA → Desc** *(jika AC QA ada)*: Aspek yang ada di AC QA tapi tidak disebutkan sama sekali di description? Ini menandakan description underspecified atau terlalu sempit dibanding scope implementasi aktual. Contoh: description hanya menyebut 1 bug fix, tapi AC QA mencakup refactor arsitektur, UI wizard baru, locking mechanism — berarti description gagal menggambarkan scope sebenarnya.
3. **Gap AC → TS**: AC yang tidak punya TS? TS penting yang hilang berdasarkan AC yang ada?
4. **Gap TS → TC**: TS yang tidak punya TC? TC yang seharusnya ada berdasarkan TS yang ada?

**Catatan evaluasi Task Feasibility:** Jika AC QA sudah ada dan scope-nya jauh lebih luas dari description, gunakan perbedaan ini sebagai bukti bahwa description tidak lengkap. Turunkan skor `completeness`, `business_rules`, `actionability`, dan `scope_boundary` sesuai besarnya gap.
