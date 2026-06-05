# TODO

- [x] Confirm implementation approach:
  - Use backend FastAPI (already has OpenRouter chat client) to perform diary sentiment analysis.
  - Avoid calling OpenRouter directly from the browser (prevents exposing API key).


- [x] Implement backend endpoint `POST /sentiment/` in `backend/app/main.py`:
  - Call existing OpenRouter chat helper with a prompt asking for structured JSON sentiment.
  - Return JSON with label/tone/detail (+ optional score/comparative).


- [x] Update frontend diary UI:
  - Modify `frontend-next/components/Diary.jsx` to call the new backend endpoint.
  - Remove usage of `frontend-next/lib/sentimentAnalysis.js` from Diary.


- [x] Add frontend API helper (optional but recommended):
  - Add `analyzeDiarySentiment(text)` in `frontend-next/lib/api.js` that calls `POST http://<backend>/sentiment/`.


- [x] Validate quickly:
  - Ensure Next build/lint passes (run `npm` build for `frontend-next` if available).
  - Ensure backend starts and endpoint returns expected JSON.


