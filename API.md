# QA Agent API Documentation

Service AI untuk generate Acceptance Criteria dan Test Cases dari Jira ticket, serta mengevaluasi kualitas artefak QA.

## Autentikasi

Semua endpoint memerlukan header:

```
x-api-secret: {API_SECRET}
```

Request tanpa header ini akan mendapat respons `401 Unauthorized`.

---

## Endpoints

### Health Check

```
GET /health
```

Tidak memerlukan autentikasi.

**Response:**
```json
{
  "status": "ok",
  "service": "qa-agent-flue"
}
```

---

### Generate Acceptance Criteria

```
POST /api/workflows/generate-ac?wait=result
```

Fetch Jira ticket → analisis requirements → generate AC → return hasilnya.

**Headers:**
```
Content-Type: application/json
x-api-secret: {API_SECRET}
```

**Body:**
```json
{
  "ticketId": "PROJ-123"
}
```

**Response sukses:**
```json
{
  "result": {
    "ac": "## Acceptance Criteria\n\n- AC-1: ...\n- AC-2: ...",
    "ticketSummary": "Judul ticket",
    "ticketUrl": "https://your-domain.atlassian.net/browse/PROJ-123",
    "acSourceCondition": "generated_from_scratch"
  },
  "_meta": {
    "runId": "workflow:generate-ac:01KVXXXX"
  }
}
```

**Nilai `acSourceCondition`:**
| Nilai | Arti |
|---|---|
| `generated_from_scratch` | Tidak ada AC sebelumnya, dibuat dari awal |
| `extracted_from_description` | AC diambil dari field description |
| `enriched_from_existing` | AC yang ada di-enrich |

**Response error:**
```json
{
  "result": {
    "error": true,
    "message": "Pesan error"
  },
  "_meta": {
    "runId": "workflow:generate-ac:01KVXXXX"
  }
}
```

**Contoh curl:**
```bash
curl -s -m 120 -X POST "http://localhost:3583/api/workflows/generate-ac?wait=result" \
  -H "Content-Type: application/json" \
  -H "x-api-secret: your-secret-key" \
  -d '{"ticketId": "PROJ-123"}'
```

---

### Generate Test Cases

```
POST /api/workflows/generate-tc?wait=result
```

Fetch Jira ticket + AC → generate Test Scenarios → generate Test Cases. Dijalankan dalam **2 prompt** untuk menghindari rate limit.

**Headers:**
```
Content-Type: application/json
x-api-secret: {API_SECRET}
```

**Body:**
```json
{
  "ticketId": "PROJ-123"
}
```

> Pastikan ticket sudah punya Acceptance Criteria (jalankan `generate-ac` terlebih dahulu).

**Response sukses:**
```json
{
  "result": {
    "tc": "### TS-01: ...\n**Type:** Functional\n...",
    "scenarioCount": 5,
    "testCaseCount": 12,
    "ticketSummary": "Judul ticket"
  },
  "_meta": {
    "runId": "workflow:generate-tc:01KVXXXX"
  }
}
```

**Response error:**
```json
{
  "result": {
    "error": true,
    "message": "Pesan error"
  },
  "_meta": {
    "runId": "workflow:generate-tc:01KVXXXX"
  }
}
```

**Contoh curl:**
```bash
curl -s -m 180 -X POST "http://localhost:3583/api/workflows/generate-tc?wait=result" \
  -H "Content-Type: application/json" \
  -H "x-api-secret: your-secret-key" \
  -d '{"ticketId": "PROJ-123"}'
```

---

### Write AC ke Jira

```
POST /api/workflows/write-jira-ac?wait=result
```

Tulis AC markdown ke field Acceptance Criteria di Jira ticket. Tidak menggunakan AI — operasi langsung ke Jira API.

**Headers:**
```
Content-Type: application/json
x-api-secret: {API_SECRET}
```

**Body:**
```json
{
  "ticketId": "PROJ-123",
  "acMarkdown": "## Acceptance Criteria\n\n- AC-1: User dapat login\n- AC-2: ...",
  "append": true
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `ticketId` | string | ID Jira ticket |
| `acMarkdown` | string | Isi AC dalam format markdown |
| `append` | boolean | `true` = tambahkan ke AC yang ada, `false` = timpa |

**Response sukses:**
```json
{
  "result": {
    "success": true,
    "message": "AC written to PROJ-123 (appended).",
    "ticketId": "PROJ-123",
    "mode": "append"
  },
  "_meta": {
    "runId": "workflow:write-jira-ac:01KVXXXX"
  }
}
```

---

### Write TC ke Jira

```
POST /api/workflows/write-jira-tc?wait=result
```

Tulis TC markdown sebagai tabel ke field Test Case di Jira ticket. Tidak menggunakan AI.

**Headers:**
```
Content-Type: application/json
x-api-secret: {API_SECRET}
```

**Body:**
```json
{
  "ticketId": "PROJ-123",
  "tcMarkdown": "### TS-01: ...\n**Type:** Functional\n...",
  "overwrite": false
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `ticketId` | string | ID Jira ticket |
| `tcMarkdown` | string | Isi TC dalam format tc.md |
| `overwrite` | boolean | `true` = timpa jika sudah ada isi (default: `false`) |

**Response sukses:**
```json
{
  "result": {
    "success": true,
    "message": "Written 5 test scenario(s) to PROJ-123.",
    "ticketId": "PROJ-123",
    "scenarioCount": 5
  },
  "_meta": {
    "runId": "workflow:write-jira-tc:01KVXXXX"
  }
}
```

**Response jika TC field sudah ada isi (dan `overwrite: false`):**
```json
{
  "result": {
    "success": false,
    "message": "TC field already has content for PROJ-123. Send overwrite: true to replace it.",
    "ticketId": "PROJ-123",
    "tcFieldWasPopulated": true
  }
}
```

---

### Evaluate QA Quality

```
POST /api/workflows/evaluate-qa?wait=result
```

Fetch Jira ticket → evaluasi kualitas AC, TS, dan TC berdasarkan rubrik terstandarisasi → kembalikan skor, verdict, gap analysis, dan rekomendasi.

**Headers:**
```
Content-Type: application/json
x-api-secret: {API_SECRET}
```

**Body:**
```json
{
  "ticketId": "PROJ-123"
}
```

**Response sukses:**
```json
{
  "result": {
    "ticketSummary": "Judul ticket",
    "ticketUrl": "https://your-domain.atlassian.net/browse/PROJ-123",

    "taskFeasibilityScore": 72.5,
    "acScore": 65.0,
    "tsScore": 58.0,
    "tcScore": 70.0,
    "qaQualityScore": 64.9,

    "verdictTaskFeasibility": "LAYAK",
    "verdictQaQuality": "CUKUP",

    "rationaleFeasibility": "Deskripsi sudah menjelaskan tujuan fitur dengan cukup baik. Business rules tercantum, namun scope boundary masih ambigu...",
    "rationaleAc": "AC mencakup aturan validasi utama dan testable. Namun beberapa AC mengandung kata abu-abu seperti 'sesuai'...",
    "rationaleTs": "TS ditulis dalam format Gherkin, namun crucial path login SSO belum tercover...",
    "rationaleTc": "Fungsionalitas utama tercover. Security testing hanya mencakup autentikasi, belum ada pengujian otorisasi per role...",

    "gapDescToAc": "- Fitur export PDF disebutkan di description tapi tidak ada AC-nya\n- Tidak ada AC untuk handling timeout session",
    "gapAcToTs": "- AC-5 (validasi format email) belum punya TS\n- Tidak ada TS untuk kondisi jaringan terputus",
    "gapTsToTc": "- TS-03 tidak memiliki TC untuk kondisi negative\n- Tidak ada TC untuk edge case input karakter khusus",

    "recommendations": [
      "Tambahkan AC untuk fitur export PDF yang disebutkan di description",
      "Buat TS untuk AC-5 (validasi format email) dengan format Gherkin",
      "Tambahkan TC security untuk pengujian otorisasi per role user"
    ]
  },
  "_meta": {
    "runId": "workflow:evaluate-qa:01KVXXXX"
  }
}
```

**Keterangan field skor:**

| Field | Keterangan |
|---|---|
| `taskFeasibilityScore` | Skor 0–100. Apakah task ini layak dikerjakan? |
| `acScore` | Skor 0–100. Kualitas Acceptance Criteria |
| `tsScore` | Skor 0–100. Kualitas Test Scenarios |
| `tcScore` | Skor 0–100. Kualitas Test Cases |
| `qaQualityScore` | Skor 0–100. = AC×30% + TS×30% + TC×40% |

**Nilai verdict `verdictTaskFeasibility`:**

| Nilai | Kondisi | Makna |
|---|---|---|
| `LAYAK` | score ≥ 70 | Task siap dikerjakan |
| `PERLU_REVISI` | 50 ≤ score < 70 | Perlu klarifikasi sebelum dikerjakan |
| `TIDAK_LAYAK` | score < 50 | Deskripsi tidak cukup jelas |

**Nilai verdict `verdictQaQuality`:**

| Nilai | Kondisi | Makna |
|---|---|---|
| `BAIK` | score ≥ 80 | Kualitas kerja QA baik |
| `CUKUP` | 60 ≤ score < 80 | Ada ruang perbaikan |
| `PERLU_PERBAIKAN` | score < 60 | Perlu perbaikan signifikan |

**Contoh curl:**
```bash
curl -s -m 300 -X POST "http://localhost:3583/api/workflows/evaluate-qa?wait=result" \
  -H "Content-Type: application/json" \
  -H "x-api-secret: your-secret-key" \
  -d '{"ticketId": "PROJ-123"}'
```

> **Catatan:** `evaluate-qa` menggunakan model reasoning yang butuh waktu 2–3 menit. Jika muncul error `[flue] prompt failed: Connection error.`, cukup ulangi perintah curl — error ini bersifat transient.

---

## Alur Penggunaan Umum

```
Generate & Write:
1. generate-ac   →  AC tersimpan di response
2. write-jira-ac →  AC ditulis ke Jira (opsional)
3. generate-tc   →  TC tersimpan di response
4. write-jira-tc →  TC ditulis ke Jira (opsional)

Evaluasi kualitas (bisa dijalankan kapan saja setelah AC/TS/TC ada):
5. evaluate-qa   →  Skor, verdict, gap analysis, dan rekomendasi

Sign-Off Document:
6. generate-sign-off  →  Dokumen sign-off markdown dari 1 ticket atau seluruh Epic
```

---

### Generate Sign-Off Document

```
POST /api/workflows/generate-sign-off
```

Fetch tiket Jira (atau seluruh child card di bawah Epic) → hitung metrics TS/TC → generate dokumen **Software Testing Sign-Off** dalam format markdown.

- Input tiket **bukan Epic**: proses 1 tiket
- Input tiket **Epic**: otomatis ambil semua child card yang memiliki Test Case, skip card dengan status Cancelled/Canceled/Backlog

**Headers:**
```
Content-Type: application/json
x-api-secret: {API_SECRET}
```

**Body:**
```json
{
  "ticketId": "PROJ-123"
}
```

**Response sukses (async — poll via `/api/run-result/{runId}`):**
```json
{
  "status": "accepted",
  "runId": "workflow:generate-sign-off:01KVXXXX"
}
```

**Hasil setelah poll completed:**
```json
{
  "status": "completed",
  "result": {
    "ticketId": "PROJ-123",
    "isEpic": true,
    "processedTickets": 5,

    "totalScenario": 47,
    "totalTc": 96,
    "passedTc": 96,
    "failedTc": 0,

    "developer": "Ahmad Za'id; Muhammad Ma'ruf Ilyasa'",
    "qa": "Dinda Ulima",

    "signOffMarkdown": "# SOFTWARE TESTING SIGN-OFF DOCUMENT\n\n---\n\n## Summary\n..."
  },
  "durationMs": 130000
}
```

**Keterangan field result:**

| Field | Keterangan |
|---|---|
| `ticketId` | Ticket ID yang diinput |
| `isEpic` | `true` jika input adalah Epic |
| `processedTickets` | Jumlah tiket yang diproses (child cards dengan TC) |
| `totalScenario` | Total Test Scenario dari semua tiket |
| `totalTc` | Total Test Case (`[+]` dan `[-]`) dari semua tiket |
| `passedTc` | TC yang passed (dicentang atau seluruh TC jika TS status = passed) |
| `failedTc` | `totalTc - passedTc` |
| `developer` | Assignee dari tiket Jira |
| `qa` | QA person yang ditemukan dari data tiket |
| `signOffMarkdown` | Dokumen sign-off lengkap dalam format markdown |

**Response jika tidak ada TC:**
```json
{
  "status": "completed",
  "result": {
    "error": true,
    "message": "Tidak ada ticket dengan Test Case yang ditemukan."
  }
}
```

> **Catatan:** Workflow ini berjalan **async** (tidak support `?wait=result`). Selalu gunakan mode poll via `/api/run-result/{runId}`. Estimasi durasi: 1–2 menit untuk single ticket, 3–5 menit untuk Epic dengan banyak child cards.

**Contoh curl:**
```bash
# Step 1 — Mulai run
RUN=$(curl -s -X POST "http://localhost:3583/api/workflows/generate-sign-off" \
  -H "Content-Type: application/json" \
  -H "x-api-secret: your-secret-key" \
  -d '{"ticketId": "PROJ-123"}')
RUN_ID=$(echo $RUN | grep -o '"runId":"[^"]*"' | cut -d'"' -f4)

# Step 2 — Poll hasil
curl "http://localhost:3583/api/run-result/$RUN_ID" \
  -H "x-api-secret: your-secret-key"
```

---

## Mode Async

Semua workflow bisa dijalankan tanpa `?wait=result` agar server tidak menahan koneksi selama proses AI berjalan.

### Step 1 — Mulai run (tanpa menunggu hasil)

Hapus `?wait=result` dari URL. Server langsung mengembalikan `runId`:

```
POST /api/workflows/evaluate-qa
```

**Response:**
```json
{
  "status": "accepted",
  "runId": "workflow:evaluate-qa:01KVXXXX"
}
```

### Step 2 — Poll hasil

```
GET /api/run-result/{runId}
x-api-secret: {API_SECRET}
```

**Saat masih berjalan:**
```json
{ "status": "running" }
```

**Saat selesai:**
```json
{
  "status": "completed",
  "result": { ...hasil workflow... },
  "durationMs": 185000
}
```

**Saat error:**
```json
{
  "status": "errored",
  "error": "Pesan error",
  "durationMs": 12000
}
```

**Run tidak ditemukan:**
```json
{ "error": "Run not found" }
```

Poll setiap 10 detik hingga `status` bukan `"running"`.

**Contoh curl:**
```bash
# Mulai run
curl -X POST "http://localhost:3583/api/workflows/evaluate-qa" \
  -H "Content-Type: application/json" \
  -H "x-api-secret: your-secret-key" \
  -d '{"ticketId": "PROJ-123"}'

# Poll hasil (ulangi sampai status != "running")
curl "http://localhost:3583/api/run-result/workflow:evaluate-qa:01KVXXXX" \
  -H "x-api-secret: your-secret-key"
```

---

## Timeout

### Mode sync (`?wait=result`)

Koneksi HTTP ditahan sampai proses selesai. Sesuaikan timeout di client:

| Endpoint | Timeout rekomendasi |
|---|---|
| `generate-ac` | 120 detik |
| `generate-tc` | 180 detik |
| `evaluate-qa` | 300 detik |
| `write-jira-ac` | 30 detik |
| `write-jira-tc` | 30 detik |
| `generate-sign-off` | — (async only, tidak support `?wait=result`) |

Untuk Postman: **Settings → General → Request timeout** → set ke `0` (tidak ada timeout).

### Mode async (tanpa `?wait=result`)

- POST awal cukup timeout **10 detik** (hanya admission, tidak menunggu proses).
- GET `/api/run-result/{runId}` cukup timeout **10 detik** (response instan).
- Poll setiap **10 detik** hingga status bukan `"running"`.
