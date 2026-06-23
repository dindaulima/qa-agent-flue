# Setup & Deployment

## 1. Konfigurasi `.env`

```env
# Model AI yang digunakan
MODEL=openai/gpt-5.4-mini
# atau
MODEL=anthropic/claude-sonnet-4-6

# API Key sesuai model yang dipilih
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key   # jika pakai Anthropic

# Jira
JIRA_BASE_URL=https://your-domain.atlassian.net/
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token

# Secret untuk autentikasi request
API_SECRET=your-secret-key

# Port server (default: 3000)
PORT=3583
```

## 2. Menjalankan Server

```bash
npm run build   # build dulu setelah ada perubahan kode
npm start       # jalankan server
```

Server berjalan di `http://localhost:3583`.

> **Jangan gunakan `npm run dev`** untuk workflow yang berjalan lama (seperti `evaluate-qa`).
> Hot-reload bisa merestart server di tengah proses dan menghapus data run yang sedang berjalan.
> Selalu gunakan `npm start` (production build) untuk penggunaan normal.

## 3. Persistensi Data

Run history disimpan di `./data/flue.db` (SQLite). Folder `data/` dibuat otomatis saat server pertama kali dijalankan.

File ini di-gitignore — tidak ikut commit. Backup manual jika diperlukan.
