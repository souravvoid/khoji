/**
 * Tauri IPC mock for browser-based E2E tests.
 *
 * The app calls Rust commands through `@tauri-apps/api/core` `invoke`, which
 * delegates to `window.__TAURI_INTERNALS__.invoke`. In a plain browser (no Rust
 * backend) we inject this mock before the app bundle loads so the UI can be
 * driven with deterministic, in-memory data.
 *
 * NOTE: keep this a self-contained function — Playwright serializes it into the
 * page context, so it must not reference any outer scope.
 */
export const tauriMock = () => {
  const SEED = [
    {
      id: 'doc-1',
      filename: 'History of Rome.pdf',
      title: 'History of Rome',
      file_path: '/docs/rome.pdf',
      file_size: 123456,
      mime_type: 'application/pdf',
      page_count: 12,
      status: 'ready',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      favorite: false,
    },
    {
      id: 'doc-2',
      filename: 'Quantum Computing Notes.pdf',
      title: 'Quantum Computing Notes',
      file_path: '/docs/quantum.pdf',
      file_size: 234567,
      mime_type: 'application/pdf',
      page_count: 8,
      status: 'ready',
      created_at: '2026-01-02',
      updated_at: '2026-01-02',
      favorite: true,
    },
  ]

  const CHUNKS = [
    { chunk_id: 'c-1', doc_id: 'doc-1', score: 0.92, content: 'The Roman Republic was founded in 509 BC after the overthrow of the monarchy. Rome expanded through the Punic Wars.', page_number: 3, doc_title: 'History of Rome' },
    { chunk_id: 'c-2', doc_id: 'doc-1', score: 0.81, content: 'Julius Caesar crossed the Rubicon in 49 BC, triggering a civil war that ended the Republic.', page_number: 7, doc_title: 'History of Rome' },
    { chunk_id: 'c-3', doc_id: 'doc-2', score: 0.88, content: 'Quantum superposition allows a qubit to represent both 0 and 1 until measured.', page_number: 2, doc_title: 'Quantum Computing Notes' },
    { chunk_id: 'c-4', doc_id: 'doc-2', score: 0.74, content: 'Entanglement correlates the states of two qubits regardless of distance.', page_number: 5, doc_title: 'Quantum Computing Notes' },
  ]

  const docDetail = (id: string) => {
    const base = SEED.find((d) => d.id === id) || SEED[0]
    return {
      ...base,
      notes: { content: '# Notes\nThis is a seeded note for ' + base.title },
      flashcards: [
        { id: 'fc-1', front: 'When was the Roman Republic founded?', back: '509 BC', known: false },
        { id: 'fc-2', front: 'What is superposition?', back: 'Qubit in both states until measured', known: false },
      ],
      quiz: [
        { id: 'q-1', question: 'Who crossed the Rubicon?', options: ['Caesar', 'Pompey', 'Brutus'], answer: 0 },
      ],
    }
  }

  const internals = {
    invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
      switch (cmd) {
        case 'get_documents':
          return SEED
        case 'get_document':
          return docDetail(args.docId as string)
        case 'search_documents': {
          const query = String(args.query || '').toLowerCase()
          if (!query) return []
          return CHUNKS.filter((c) => c.content.toLowerCase().includes(query) || c.doc_title.toLowerCase().includes(query))
        }
        case 'process_document':
          return { doc_id: 'doc-' + Math.random().toString(36).slice(2, 8) }
        case 'generate_flashcards':
          return docDetail(args.docId as string).flashcards
        case 'generate_quiz':
          return docDetail(args.docId as string).quiz
        case 'generate_timeline':
          return [
            { year: '509 BC', event: 'Roman Republic founded' },
            { year: '49 BC', event: 'Caesar crosses the Rubicon' },
          ]
        case 'generate_mindmap':
          return 'mindmap\n  root((Rome))\n    Republic'
        case 'ask_ai':
          return { response: 'This is a mocked AI response for: ' + String(args.message || '') }
        case 'get_models':
          return [{ id: 'llama3', name: 'Llama 3', status: 'available' }]
        case 'get_chat_history':
          return []
        case 'save_notes':
          return undefined
        case 'delete_document':
          return undefined
        case 'export_document':
          return { filename: 'export.md', content: '# Export' }
        case 'check_processing_status':
          return { status: 'ready' }
        case 'get_processing_progress':
          return { progress: 100 }
        default:
          return undefined
      }
    },
    transformCallback: (cb: unknown) => cb,
    unregisterCallback: () => {},
    convertFileSrc: (p: string) => p,
  }

  // @ts-expect-error inject mock into Tauri internals
  window.__TAURI_INTERNALS__ = internals
}

export default tauriMock
