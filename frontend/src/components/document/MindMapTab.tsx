import { useState, useEffect, useCallback } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Download, Loader2 } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { useDocumentStore } from '../../stores/documentStore'
import { generateMindmap, type MindMapTree, type MindMapNode } from '../../lib/ipc'
import { MINDMAP_MIN_ZOOM, MINDMAP_MAX_ZOOM, MINDMAP_DEFAULT_ZOOM } from '../../lib/constants'

function parseMermaid(mermaidStr: string): MindMapTree {
  const idToLabel: Record<string, string> = {}
  const edges: Record<string, string[]> = {}
  const childIds = new Set<string>()

  const lines = mermaidStr.split('\n')
  for (const line of lines) {
    const nodeMatch = line.match(/^\s*(\w+)\["(.+?)"\]/)
    if (nodeMatch) {
      const [, id, label] = nodeMatch
      idToLabel[id] = label.replace(/#quot;/g, '"')
      continue
    }
    const edgeMatch = line.match(/^\s*(\w+)\s*-->\s*(\w+)/)
    if (edgeMatch) {
      const [, parent, child] = edgeMatch
      if (!edges[parent]) edges[parent] = []
      edges[parent].push(child)
      childIds.add(child)
    }
  }

  const allIds = Object.keys(idToLabel)
  const rootId = allIds.find(id => !childIds.has(id)) || allIds[0]

  if (!rootId) {
    return { topic: 'No structure found', nodes: [] }
  }

  function buildNode(id: string): MindMapNode {
    const label = idToLabel[id] || id
    const children = (edges[id] || []).map(buildNode)
    return { label, children }
  }

  const rootNode = buildNode(rootId)
  return {
    topic: rootNode.label,
    nodes: rootNode.children
  }
}

function TreeNode({ node }: { node: MindMapNode }) {
  return (
    <li>
      <div className="mm-node">{node.label}</div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child, j) => (
            <TreeNode key={j} node={child} />
          ))}
        </ul>
      )}
    </li>
  )
}

const TREE_STYLES = `
.mm-tree, .mm-tree ul { display: flex; justify-content: center; padding: 0; margin: 0; list-style: none; }
.mm-tree ul { position: relative; padding-top: 24px; }
.mm-tree li { list-style: none; position: relative; padding: 24px 12px 0; }
.mm-tree li::before, .mm-tree li::after {
  content: ''; position: absolute; top: 0; right: 50%;
  border-top: 2px solid var(--color-border-default, #cbd5e1);
  width: 50%; height: 24px;
}
.mm-tree li::after { right: auto; left: 50%; border-left: 2px solid var(--color-border-default, #cbd5e1); }
.mm-tree li:only-child::before, .mm-tree li:only-child::after { display: none; }
.mm-tree li:only-child { padding-top: 0; }
.mm-tree li:first-child::before, .mm-tree li:last-child::after { border: 0 none; }
.mm-tree li:last-child::before { border-right: 2px solid var(--color-border-default, #cbd5e1); border-radius: 0 6px 0 0; }
.mm-tree li:first-child::after { border-radius: 6px 0 0 0; }
.mm-tree ul::before {
  content: ''; position: absolute; top: 0; left: 50%;
  border-left: 2px solid var(--color-border-default, #cbd5e1);
  width: 0; height: 24px;
}
.mm-node {
  display: inline-block; padding: 8px 16px; border-radius: 8px; white-space: nowrap;
  background: #ffffff; border: 1px solid #cbd5e1; font-size: 13px; color: #1e293b;
}
.mm-root {
  background: #6366f1; color: #ffffff; border-color: transparent;
  font-size: 16px; font-weight: 600; padding: 12px 24px; border-radius: 9999px;
}
`

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
      <style>{TREE_STYLES}</style>
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
            <ul className="mm-tree">
              <li>
                <div className="mm-node mm-root">{tree.topic}</div>
                {tree.nodes.length > 0 && (
                  <ul>
                    {tree.nodes.map((node: MindMapNode, i: number) => (
                      <TreeNode key={i} node={node} />
                    ))}
                  </ul>
                )}
              </li>
            </ul>
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
