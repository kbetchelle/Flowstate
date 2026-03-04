/**
 * Dependency Graph: nodes = tasks, edges = task links. Open from command palette.
 * Spec §2 Q56, Phase 13.
 */

import { useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import { useTaskStore } from '../stores/taskStore'
import { useLinkStore } from '../stores/linkStore'
import { useUIStore } from '../stores/uiStore'

const NODE_WIDTH = 160
const NODE_HEIGHT = 44
const PADDING = 24

export function DependencyGraphView({ onClose }: { onClose: () => void }) {
  const setDependencyGraphOpen = useAppStore((s) => s.setDependencyGraphOpen)
  const tasks = useTaskStore((s) => s.tasks)
  const links = useLinkStore((s) => s.links)
  const setEditPanelTaskId = useUIStore((s) => s.setEditPanelTaskId)

  const { nodeIds, positions, width, height } = useMemo(() => {
    const ids = new Set<string>()
    for (const l of links) {
      ids.add(l.source_id)
      ids.add(l.target_id)
    }
    const arr = Array.from(ids)
    const cols = Math.max(1, Math.ceil(Math.sqrt(arr.length)))
    const pos = new Map<string, { x: number; y: number }>()
    arr.forEach((id, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      pos.set(id, {
        x: PADDING + col * (NODE_WIDTH + 40),
        y: PADDING + row * (NODE_HEIGHT + 24),
      })
    })
    const w = PADDING * 2 + cols * (NODE_WIDTH + 40) - 40
    const rows = Math.ceil(arr.length / cols)
    const h = PADDING * 2 + rows * (NODE_HEIGHT + 24) - 24
    return { nodeIds: arr, positions: pos, width: Math.max(400, w), height: Math.max(300, h) }
  }, [links])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setDependencyGraphOpen(false)
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setDependencyGraphOpen, onClose])

  const taskTitle = (id: string) => tasks.find((t) => t.id === id)?.title ?? id.slice(0, 8)

  return (
    <div
      role="dialog"
      aria-label="Dependency Graph"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setDependencyGraphOpen(false)
          onClose()
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg, #fff)',
          padding: 16,
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Dependency Graph</h2>
          <button
            type="button"
            onClick={() => {
              setDependencyGraphOpen(false)
              onClose()
            }}
            style={{ padding: '6px 12px' }}
          >
            Close
          </button>
        </div>
        {links.length === 0 ? (
          <p style={{ margin: 0, color: '#666' }}>No task links yet. Add links in the full edit panel (Cmd+Shift+E on a task).</p>
        ) : (
          <svg
            width={width}
            height={height}
            style={{ display: 'block' }}
          >
            <defs>
              <marker
                id="arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 Z" fill="#666" />
              </marker>
            </defs>
            {links.map((link) => {
              const src = positions.get(link.source_id)
              const tgt = positions.get(link.target_id)
              if (!src || !tgt) return null
              const sx = src.x + NODE_WIDTH / 2
              const sy = src.y + NODE_HEIGHT
              const tx = tgt.x + NODE_WIDTH / 2
              const ty = tgt.y
              const stroke = link.link_type === 'dependency' ? '#1976d2' : '#888'
              return (
                <line
                  key={link.id}
                  x1={sx}
                  y1={sy}
                  x2={tx}
                  y2={ty}
                  stroke={stroke}
                  strokeWidth={link.link_type === 'dependency' ? 2 : 1}
                  markerEnd="url(#arrow)"
                />
              )
            })}
            {nodeIds.map((id) => {
              const pos = positions.get(id)
              if (!pos) return null
              return (
                <g key={id}>
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={6}
                    fill="var(--bg, #fff)"
                    stroke="#666"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setEditPanelTaskId(id)}
                  />
                  <text
                    x={pos.x + NODE_WIDTH / 2}
                    y={pos.y + NODE_HEIGHT / 2 + 4}
                    textAnchor="middle"
                    fontSize={12}
                    fill="var(--text, #111)"
                    style={{ pointerEvents: 'none' }}
                  >
                    {(taskTitle(id) || '(No title)').slice(0, 20)}
                    {(taskTitle(id) || '').length > 20 ? '…' : ''}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
