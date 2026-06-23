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

Untuk Postman: **Settings → General → Request timeout** → set ke `0` (tidak ada timeout).

### Mode async (tanpa `?wait=result`)

- POST awal cukup timeout **10 detik** (hanya admission, tidak menunggu proses).
- GET `/api/run-result/{runId}` cukup timeout **10 detik** (response instan).
- Poll setiap **10 detik** hingga status bukan `"running"`.
