# Feature Status

Live end-to-end test of every feature (real engine, real local LLM, real docs).
Status legend: PASS = works on real data; GRACE = correct graceful handling
(no crash); FAIL = broken.

| # | Feature | Status | Steps | Expected | Actual | Bug | Fixed (commit) | Notes |
|---|---------|--------|--------|----------|--------|-----|----------------|-------|
| 1 | Ingest .txt | PASS | upload sample.txt → process_document_stream | notes+chunks created | chunks=7, notes saved | — | — | fast |
| 2 | Ingest .md | PASS | upload sample.md | notes+chunks | chunks=7 | — | — | frontmatter stripped |
| 3 | Ingest .csv | PASS | upload sample.csv | notes+chunks | chunks=14 | — | — | |
| 4 | Ingest .pdf | PASS | upload sample.pdf | notes+chunks | chunks=4 | — | — | text extracted via fitz |
| 5 | Ingest .docx | PASS | upload sample.docx | notes+chunks | chunks=4 | — | — | python-docx |
| 6 | Ingest .pptx | PASS | upload sample.pptx | notes+chunks | chunks=9 | — | — | python-pptx |
| 7 | Ingest .epub | PASS | upload sample.epub | notes+chunks | chunks=7 | — | — | ebooklib |
| 8 | Ingest unicode (Hindi/Chinese/Arabic/emoji) | PASS | upload unicode.txt | notes+chunks, no mojibake | chunks=2 | — | — | UTF-8 preserved |
| 9 | Ingest large (~5100 word) | PASS | upload large.txt | notes+chunks | chunks=37 | — | — | no timeout |
| 10 | Ingest empty (0 B) | GRACE | upload empty.txt | safe error, no crash | success:false, "No text could be extracted" | — | — | correct |
| 11 | Ingest corrupt PDF | GRACE | upload corrupt.pdf | safe error, no crash | success:false | — | — | correct |
| 12 | Semantic search | PASS | search "Renaissance" | ranked chunks | hits=5, top≈0.39 | — | — | FAISS cosine |
| 13 | Keyword search | PASS | search keyword | matched chunks | hits returned | — | — | |
| 14 | Search empty query | PASS | search "" | safe handling | no crash | — | — | |
| 15 | Chat (stream) | PASS | chat_stream about doc | coherent answer | 2.83s, "began around 1400 AD in Italy" | BUG-C | df492e2 | model fallback |
| 16 | Flashcards | PASS | generate_flashcards | Q/A pairs from notes | 5 cards | — | — | rule-based |
| 17 | Quiz | PASS | generate_quiz | MCQs from notes | 5 questions | — | — | |
| 18 | Timeline | PASS | generate_timeline | dated events | events parsed | — | — | date regex |
| 19 | Mind map | PASS | generate_mindmap | mermaid graph | graph returned | — | — | |
| 20 | Notes save | PASS | notes_save | persisted | success | — | — | |
| 21 | Notes get | PASS | notes_get | returns stored notes | content returned | — | — | |
| 22 | Notes missing doc | PASS | notes_get bad id | safe null | null, no crash | — | — | |
| 23 | Export markdown | PASS | export md | .md string | ok | — | — | |
| 24 | Export html | PASS | export html | .html string | ok | — | — | |
| 25 | Export json | PASS | export json | .json string | 6005 B | BUG-D | 225589f | include kwarg |
| 26 | Export anki | PASS | export anki | .apkg bytes | ok | — | — | genanki |
| 27 | Export csv | PASS | export csv | .csv string | ok | — | — | |
| 28 | Export quiz | PASS | export quiz | .md quiz | ok | — | — | |
| 29 | Export mermaid | PASS | export mermaid | .mmd | ok | — | — | |
| 30 | Export docx | PASS | export docx | .docx bytes | ok | — | — | python-docx |
| 31 | Models list | PASS | models_list | lists presets + note | ok | — | — | |
| 32 | Set invalid model | PASS | set_model "bad" | clear error | error msg | — | — | |
| 33 | Delete document | PASS | delete_document | removed + chunks+notes gone | ok | — | — | DB index kept |

**Summary:** 31/33 PASS, 2/33 GRACE (intended), 0 FAIL.
