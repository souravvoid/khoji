import { useState, useEffect, useCallback } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Download, Loader2 } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { useDocumentStore } from '../../stores/documentStore'
import { generateMindmap, type MindMapTree, type MindMapNode } from '../../lib/ipc'
import { MINDMAP_MIN_ZOOM, MINDMAP_MAX_ZOOM, MINDMAP_DEFAULT_ZOOM, MINDMAP_MAX_NODES } from '../../lib/constants'

function parseMermaid(mermaidStr: string): MindMapTree {
  const result: MindMapTree = { topic: 'Document', nodes: [] }
  const lines = mermaidStr.split('\n').filter(l => l.trim() && !l.startsWith('flowchart') && !l.includes('-->'))
  const currentNodes: MindMapNode[] = []
  
  for (const line of lines) {
    const match = line.match(/\["(.+?)"\]/)
    if (!match) continue
    const label = match[1]
    if (!result.topic || result.topic === 'Document') {
      result.topic = label
    } else if (currentNodes.length < MINDMAP_MAX_NODES) {
      const node: MindMapNode = { label, children: [] }
      currentNodes.push(node)
      result.nodes.push(node)
    }
  }
  
  if (result.nodes.length === 0) {
    result.nodes = [{ label: 'No structure found', children: [] }]
  }
  return result
}

export function MindMapTab() {
  const { activeDocument } = useDocumentStore()
  const [zoom, setZoom] = useState(100)
  const [mermaidStr, setMermaidStr] = useState('')
  const [tree, setTree] = useState<MindMapTree | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activeDocument) return
      setLoading(true)
    generateMindmap(activeDocument.id)
      .then((str: string) => {
        setMermaidStr(str)
        setTree(parseMermaid(str))
      })
      .catch(() => {
        setMermaidStr('')
        setTree({ topic: 'Error', nodes: [{ label: 'Could not generate mind map', children: [] }] })
      })
      .finally(() => setLoading(false))
  }, [activeDocument?.id])

  const handleExport = useCallback(() => {
    if (!mermaidStr) return
    const blob = new Blob([mermaidStr], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeDocument?.title || 'document'}-mindmap.mmd`
    a.click()
    URL.revokeObjectURL(url)
  }, [mermaidStr, activeDocument])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border-default">
        <h3 className="text-sm font-semibold text-text-primary">Mind Map</h3>
        <div className="flex items-center gap-1">
           <IconButton icon={<ZoomOut size={16} />} label="Zoom out" size="sm" onClick={() => setZoom(Math.max(MINDMAP_MIN_ZOOM, zoom - 10))} />
          <span className="text-xs text-text-tertiary w-10 text-center">{zoom}%</span>
          <IconButton icon={<ZoomIn size={16} />} label="Zoom in" size="sm" onClick={() => setZoom(Math.min(MINDMAP_MAX_ZOOM, zoom + 10))} />
          <IconButton icon={<Maximize2 size={16} />} label="Fit to screen" size="sm" onClick={() => setZoom(MINDMAP_DEFAULT_ZOOM)} />
          <IconButton icon={<Download size={16} />} label="Export diagram" size="sm" onClick={handleExport} />
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-bg-secondary bg-[radial-gradient(var(--color-border-default)_1px,transparent_1px)] bg-[length:20px_20px] p-8">
        <div className="flex items-center justify-center min-h-full transition-transform" style={{ transform: `scale(${zoom / 100})` }}>
          {tree ? (
            <div className="flex flex-col items-center gap-6">
              <div className="px-6 py-3 bg-primary-500 text-white rounded-full text-lg font-bold shadow-lg">
                {tree.topic}
              </div>
              <div className="flex flex-wrap justify-center gap-4 max-w-3xl">
                {tree.nodes.map((node: MindMapNode, i: number) => (
                  <div key={i} className="flex flex-col items-center gap-3">
                    <div className="w-px h-4 bg-primary-300" />
                    <div className="px-4 py-2 bg-surface-card border border-primary-300 rounded-lg text-sm font-medium text-text-primary shadow-sm">
                      {node.label}
                    </div>
                    {node.children.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-2">
                        {node.children.map((child: MindMapNode, j: number) => (
                          <div key={j} className="flex flex-col items-center">
                            <div className="w-px h-3 bg-border-default" />
                            <div className="px-3 py-1.5 bg-bg-tertiary rounded text-xs text-text-secondary">
                              {child.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-text-tertiary">No mind map data available</p>
          )}
        </div>
      </div>
      <div className="px-6 py-2 border-t border-border-default text-xs text-text-tertiary flex items-center gap-4">
        <span>Scroll to zoom</span>
        <span>Export as Mermaid (.mmd)</span>
      </div>
    </div>
  )
}
