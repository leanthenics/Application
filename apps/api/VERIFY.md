# Manual verification checklist — ClickRetina API

> You run these by hand to sign off a step. **Postman is the primary path**; PowerShell equivalents are
> given for each. Base URL: `http://localhost:54321`. Keep this file current as phases land.

## 0. Prerequisites
- [ ] `apps/api/.env` has `REDIS_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `REPLICATE_API_TOKEN`,
      `REPLICATE_MODEL` set.
- [ ] **Two terminals running** from the repo root:
  - `pnpm dev:api`    → logs `[clickretina-api] listening on http://localhost:54321`
  - `pnpm dev:worker` → logs `[worker] started; consuming queue "jobs"`
- [ ] A test image base64 ready. Regenerate any time with:
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ClickRetina\sample-image.jpeg.jpeg")) | Set-Content -NoNewline image.b64.txt
  ```
  (A pre-made copy is written to the session scratchpad as `sample-image.b64.txt` — open it and copy the
  string into Postman's `image` field.)

---

## 1. Health — API is up
**Postman:** `GET http://localhost:54321/health`
**Expect:** `200`, body `{ "status": "ok", "service": "clickretina-api", "uptime": <num>, "timestamp": <iso> }`

**PowerShell:**
```powershell
Invoke-RestMethod http://localhost:54321/health
```

---

## 2. Happy path — create a job
**Postman:** `POST http://localhost:54321/jobs`
- Header: `Content-Type: application/json`
- Body → raw → JSON:
  ```json
  { "image": "<PASTE base64 from sample-image.b64.txt>", "mimeType": "image/jpeg", "prompt": "Add a mid-century modern tan leather sofa and a tall potted plant in the corner" }
  ```
**Expect:** `202`, body `{ "jobId": "<uuid>" }`. Copy the `jobId`.

**PowerShell (does the whole lifecycle):**
```powershell
$img  = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ClickRetina\sample-image.jpeg.jpeg"))
$body = @{ image=$img; mimeType='image/jpeg'; prompt='Add a mid-century modern tan leather sofa and a tall potted plant in the corner' } | ConvertTo-Json
$post = Invoke-RestMethod -Uri http://localhost:54321/jobs -Method Post -ContentType 'application/json' -Body $body
$post.jobId
```

---

## 3. Poll the job to completion
**Postman:** `GET http://localhost:54321/jobs/<jobId>` — send repeatedly (every ~3s).
**Expect the status to progress:** `queued` → `processing` → `completed` (usually ~15–25s).

On `completed`, check `result`:
- [ ] `result.mimeType` is `image/png` **or** `image/webp` (Qwen's real output type — **not** forced to jpeg).
- [ ] `result.products` has **3 entries** (still the B2.3/B2.4 stubs: `modern white sofa`, etc., `&tag=` empty). ✔ expected for now.
- [ ] `result.outputImage` is a long base64 string and is **NOT equal to the input** (i.e. a real edit, not the echo).

**Worker terminal should show (in order):**
```
[pipeline] <jobId> enhancePrompt ok (~Nms)
[pipeline] <jobId> enhancedPrompt="..."
[pipeline] <jobId> editImage ok (~Nms)
[worker] completed <jobId>
```

**PowerShell (poll + save the edited image to view it):**
```powershell
do { Start-Sleep 3; $r = Invoke-RestMethod "http://localhost:54321/jobs/$($post.jobId)"; $r.status } until ($r.status -in 'completed','failed')
$r.result.mimeType
$r.result.products
$ext = $r.result.mimeType.Split('/')[1]
[IO.File]::WriteAllBytes("C:\ClickRetina\edited.$ext", [Convert]::FromBase64String($r.result.outputImage))
Invoke-Item "C:\ClickRetina\edited.$ext"   # opens the edited image to eyeball it
```

---

## 4. Validation — empty / invalid body → 400
**Postman:** `POST /jobs` with body `{ "prompt": "" }`
**Expect:** `400`, body `{ "error": { "code": "invalid_request", "message": "..." } }`

**PowerShell (curl.exe shows the status code cleanly):**
```powershell
curl.exe -s -w "`n%{http_code}`n" -X POST http://localhost:54321/jobs -H "content-type: application/json" -d "{\"prompt\":\"\"}"
```

## 5. Malformed JSON → 400
**Postman:** `POST /jobs` with body `{ not json`
**Expect:** `400`, `{ "error": { "code": "invalid_json", ... } }`

```powershell
curl.exe -s -w "`n%{http_code}`n" -X POST http://localhost:54321/jobs -H "content-type: application/json" -d "{ not json"
```

## 6. Unknown / expired job id → 404
**Postman:** `GET /jobs/does-not-exist`
**Expect:** `404`, `{ "error": { "code": "not_found", "message": "Job not found or expired" } }`

```powershell
curl.exe -s -w "`n%{http_code}`n" http://localhost:54321/jobs/does-not-exist
```

---

## 7. (Optional) Failure path — a model error ends the job `failed`
Temporarily break a credential to confirm fail-fast surfaces a `failed` status (not a crash):
1. In `apps/api/.env` set `REPLICATE_API_TOKEN=bad`; the worker (`tsx watch`) reloads.
2. Run checks 2–3. **Expect:** status reaches `failed`, and `GET` returns `error` with a message; the
   worker logs `[worker] failed <jobId>: ...` and **keeps running** (one bad job doesn't kill it).
3. Restore the real token.

---

### Sign-off (B2.2)
- [ ] Checks 1–3 pass and the saved image is a genuine edit (furniture added, room preserved).
- [ ] Checks 4–6 return the right 400/404 envelopes.
- [ ] (Optional) Check 7 ends `failed` cleanly.

---

## 8. Model 3 (key-terms) + retry net + GET race (B2.3 / B2.6)
On a completed job (check 3), additionally confirm:
- [ ] `result.products` = up to 5 **real, descriptive** key-terms read from the edited image
      (e.g. "mid-century brown leather sofa"), **not** the old stubs (modern white sofa / coffee table /
      arc lamp). Each has a well-formed `amazonUrl` (tag empty for now).
- [ ] **No `completed` + `result: null`** — when `status` first reads `completed`, `result` is already
      populated (the read-skew race fix). If you ever see completed with null result, that's a regression.
- [ ] **Retry net (worker log):** on a live Gemini/Replicate 429/503 you'll see
      `[retry] <label> attempt N failed (status 503); retrying in <ms>ms`. Up to 3 attempts total, then
      the job fails fast (sustained outage). A clean run shows **no** `[retry]` lines.

> Verified live 2026-06-30: 5 real keyterms returned; retry recovered a 503 (`retrying in 846ms`) and
> also failed fast after 3×503; GET no longer returns completed-with-null.
