# context
generate ac hasilnya kurang bagus. butuh improvement. Sepertinya karena deskripsi jiranya kurang baik. Aku menemukan task dengan deskripsi jira yang kurang sesuai atau scopenya terlalu kecil, sedangan scope pengerjaan fiturnya jauh lebih besar. QA bisa saja mengabaikan deskripsi jira dan langsung menuliskan scope dan aturan fitur baik business rules maupun masalah teknikal. kalau tidak salah aku sudah pernah menginstruksikan bahwa priority utama harusnya dari AC QA, baru kemudian dari deskripsi jira yang ditulis PM (bisa jad ijuga mengandung AC)

# goals
1. 
2. jika ada, gunakan tools untuK membaca data jira dan mengekstrak Description,  Acceptance Criteria (AC), Test Scenarios (TS) dan Test Cases (TC). Data TS dan TC dari jira berbentuk Adf tabel.
3. Data Desc/AC/TS/TC yang sudah diekstrak akan dinilai oleh agent/skill.
4. agent/skill harus bisa melakukan evaluasi berikut:
   - Kriteria Task Feasibility:
      -- Expected Result: Apakah goals dari task sudah jelas? Apakah menjelaskan job to be done user? Apakah sudah menjelaskan ekspektasi dari fitur?
      -- Business Rules: Apakah business rules atau acceptance criteria tertulis dengan jelas?
      -- Clarity: Apakah ada feature/bug yang ditulis masih ambigu? Apakah bisa dipahami oleh orang yang membaca?
      -- Completeness: Apakah sudah menyertakan context, stories, ekspektasi, bisnis rules dan scope secara jelas? 
      -- Actionability: Apakah QA and Dev bisa mulai bekerja setelah membaca deskripsi jira tanpa bertanya lagi?
      -- Scope boundary: Apakah jelas mana yang masuk scope dan diluar scope?
   - Kriteria AC:
      -- Validity: Apakah AC mengandung aturan/rules yang harus dipenuhi?
      -- Behavioral Clarity: Apakah AC mendeskripsikan perilaku sistem yang dapat diamati seperti cara KERJA sistem atau output data yang dihasilkan sistem? 
      -- Testability: Bisakah AC diverifikasi melalui pengujian?
      -- Non-ambiguity: AC tidak mengndung kalimat abu-abu seperti "cepat","user friendly", "benar", "sesuai" tanpa definisi yang jelas.
      -- Business alignment: Apakah mencakup business rules yang dibuat PM, bukan hanya masalah teknikal?
      -- Dependency awareness: Apakah mencakup cara menghandle sistem-sitem lain yang terintegrasi?
   - Kriteria TS:
      -- Journey based: Ditulis berdasarkan POV User (Given/When/Then)?
      -- Real-world relevance: Apakah skenario merefleksikan perilaku user sebenarnya?
      -- Crucial paths covered: Apakah sudah mencakup user journey paling penting dan krusial sesuai jobs to be done-nya?
      -- Full Coverage: Apakah mencakup skenario yang terjadi jika semua hal tidak berjalan sesuai rencana? Apakah mencakup hal-hal yang bisa dilakukan user dan tidak bisa dilakukan user?
      -- Prioritization: apakah MoSCoW priority sudah tepat dan masuk akal untuk setiap TS? Apakah minimal ada satu TS yang ditandai sebagai M (Must Have)?
   - Kriteria TC:
      -- Functional: Apakah fungsionalitas utama dari fitur sudah dicover? 
      -- Visual/UI: Apakah mencakup pengujian terhadap Layout, responsiveness, typography, component states?
      -- Flow/UX: Apakah menggambarkan End-to-end user journey dan dengan input dari fitur lain atau output untuk fitur lainnya?
      -- Security: Apakah mencakup pengujian terkait autentikasi, hak akses, percobaan melanggar security dan otorisasi? 
      -- Edge cases: Apakah mencakup kasus-kasus anomali dan jarang terjadi? Mencakup nilai-nilai batas yang boleh atau tidak boleh diinputkan user?
      -- Data validation: Apakah mencakup pengujian terhadap Required fields, format checks, type constraints, expected output?
      -- Anomaly/negative: Unexpected inputs, broken flows, race conditions
   - nilai gap kualitas:
      -- Nilai kelengkapan AC: Apakah ada Deskripsi yang belum tercover di AC? Apakah ada AC yang harusnya ada tapi belum ada?
      -- Nilai kelengkapan TS: Apakah ada AC yang belum tercover di TS? Apakah ada TS yang harusnya ada tapi belum ada?
      -- Nilai kelengkapan TC: Apakah ada TS yang belum tercover di TC? Apakah ada TC yang harusnya ada tapi belum ada?
5. Buatkan tools unuk menghitung nilai kualitas dengan bobot Criteria Penilaian sebagai berikut:
   - Task Feasibility (total 100%)
      -- Expected Result = 20%
      -- Business Rules = 20%
      -- Clarity = 20%
      -- Completeness = 15%
      -- Actionability = 15%
      -- Scope Boundary = 10%
   - AC (total 100%)
      -- Validity = 20%
      -- Behavioral Clarity = 20%
      -- Testability = 25%
      -- Non-ambiguity = 15%
      -- Business Alignment = 15%
      -- Dependency Awareness = 5%
   - TS (total 100%)
      -- Journey Based = 15%
      -- Real-world Relevance = 20%
      -- Crucial Paths Covered = 30%
      -- Full Coverage = 25%
      -- Prioritization = 10%
   - TC (total 100%)
      -- Functional = 25%
      -- Visual/UI = 10%
      -- Flow/UX = 15%
      -- Security = 20%
      -- Edge Cases = 10%
      -- Data Validation = 10%
      -- Anomaly/Negative = 10%
6. Nilai Task Feasibility Score  digunakan untuk menentukan "Apakah task ini layak dikerjakan?"
   Nilai QA Quality Score = AC (30%) + TS (30%) + TC (40%) → digunakan untuk menilai "Seberapa baik kualitas kerja QA?"



5. OUTPUT a structured gap report in Bahasa Indonesia using this exact format:

---
## Hasil Evaluasi QA

### 1. Kelayakan Task Jira
AC yang sudah ada: [list]
Requirement yang belum memiliki AC:
- [requirement 1]
- [requirement 2]

### 1. AC Coverage dari Deskripsi
Coverage: X/Y (Z%)
AC yang sudah ada: [list]
Requirement yang belum memiliki AC:
- [requirement 1]
- [requirement 2]

### 2. TS Coverage dari AC
Coverage: X/Y (Z%)
TS yang sudah ada: [list]
AC yang belum memiliki TS:
- [AC item 1]
- [AC item 2]

### 3. TC Coverage dari TS
Coverage: X/Y (Z%)
TC yang sudah ada: [list]
TS yang belum memiliki TC:
- [TS item 1]
- [TS item 2]

### Rekomendasi
[Short summary of the most critical gaps to fix first]
---

IMPORTANT RULES:
- If a layer is missing entirely from the Jira card (e.g., no TS written at all), state it clearly and set coverage to 0/total (0%)
- Do not invent items that are not written in the card — only evaluate what exists
- For gap detection, use your knowledge as a senior QA to identify what is genuinely missing, not just what is unlabeled or uncounted
- Be specific when listing missing items — explain briefly why it should exist
- Output must be in Bahasa Indonesia