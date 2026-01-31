import { useState, useCallback, useRef, useEffect } from 'react'
import './App.css'

const H = 1
const V = 2
const HV = 3

const SIZE = 80
const BORDER = 2
const MARGIN = 2
const GRID_SIZE = SIZE + BORDER * 2 + MARGIN
const GRID_OFFSET = MARGIN + BORDER * 2 // First valid grid position (6px)
const RECTANGLE = SIZE * 2 + BORDER * 2 + MARGIN

interface PieceConfig {
  id: number
  row: number
  col: number
  type: number | null
  text: string
}

interface PiecePosition {
  top: number
  left: number
  width: number
  height: number
}

const initialPieces: PieceConfig[] = [
  { id: 1, row: 1, col: 1, type: V, text: '\u{1f33f}' },
  { id: 2, row: 1, col: 2, type: HV, text: '\u{1f43c}' },
  { id: 3, row: 1, col: 4, type: V, text: '\u{1f33f}' },
  { id: 4, row: 3, col: 1, type: V, text: '\u{1f33f}' },
  { id: 5, row: 3, col: 4, type: V, text: '\u{1f33f}' },
  { id: 6, row: 3, col: 2, type: H, text: '\u{1f343}' },
  { id: 7, row: 4, col: 2, type: null, text: '\u{1f98b}' },
  { id: 8, row: 4, col: 3, type: null, text: '\u{1f99c}' },
  { id: 9, row: 5, col: 1, type: null, text: '\u{1f98e}' },
  { id: 10, row: 5, col: 4, type: null, text: '\u{1f41b}' },
]

function calculatePosition(row: number, col: number, type: number | null): PiecePosition {
  let width = SIZE
  let height = SIZE
  const top = MARGIN * row + (SIZE * (row - 1) + BORDER * 2 * row)
  const left = MARGIN * col + (SIZE * (col - 1) + BORDER * 2 * col)

  switch (type) {
    case H:
      width = RECTANGLE
      break
    case V:
      height = RECTANGLE
      break
    case HV:
      height = RECTANGLE
      width = RECTANGLE
      break
  }

  return { top, left, width, height }
}

function isIntersect(
  pos: { top: number; left: number },
  aWidth: number,
  aHeight: number,
  b: PiecePosition
): boolean {
  const aTop = pos.top
  const aLeft = pos.left
  const aBottom = aTop + aHeight
  const aRight = aLeft + aWidth
  const bTop = b.top
  const bLeft = b.left
  const bBottom = bTop + b.height
  const bRight = bLeft + b.width

  return !(bLeft >= aRight || bRight <= aLeft || bTop >= aBottom || bBottom <= aTop)
}

interface PieceProps {
  config: PieceConfig
  position: PiecePosition
  onDragStart: (id: number, e: React.MouseEvent | React.TouchEvent) => void
  zIndex: number
}

function Piece({ config, position, onDragStart, zIndex }: PieceProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    onDragStart(config.id, e)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    onDragStart(config.id, e)
  }

  return (
    <div
      className={`item figure-${config.type}`}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: position.height,
        zIndex,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <span className="text">{config.text}</span>
    </div>
  )
}

function App() {
  const [positions, setPositions] = useState<Map<number, PiecePosition>>(() => {
    const map = new Map<number, PiecePosition>()
    initialPieces.forEach((piece) => {
      map.set(piece.id, calculatePosition(piece.row, piece.col, piece.type))
    })
    return map
  })

  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [zIndices, setZIndices] = useState<Map<number, number>>(() => {
    const map = new Map<number, number>()
    initialPieces.forEach((piece, index) => {
      map.set(piece.id, index)
    })
    return map
  })

  const dragStartRef = useRef<{ x: number; y: number; startPos: PiecePosition } | null>(null)
  const gameRef = useRef<HTMLDivElement>(null)
  const maxZIndexRef = useRef(initialPieces.length)

  const getPieceConfig = useCallback((id: number) => {
    return initialPieces.find((p) => p.id === id)!
  }, [])

  const snapToGrid = useCallback((value: number): number => {
    const gridIndex = Math.round((value - GRID_OFFSET) / GRID_SIZE)
    return GRID_OFFSET + Math.max(0, gridIndex) * GRID_SIZE
  }, [])

  const checkCollisions = useCallback(
    (
      draggedId: number,
      newPos: { top: number; left: number },
      width: number,
      height: number
    ): boolean => {
      for (const [id, pos] of positions) {
        if (id === draggedId) continue
        if (isIntersect(newPos, width, height, pos)) {
          return true
        }
      }
      return false
    },
    [positions]
  )

  const isPathClear = useCallback(
    (
      startPos: PiecePosition,
      targetPos: { top: number; left: number },
      width: number,
      height: number,
      pieceId: number
    ) => {
      const deltaX = targetPos.left - startPos.left
      const deltaY = targetPos.top - startPos.top

      const steps = Math.max(Math.abs(deltaX), Math.abs(deltaY)) / GRID_SIZE
      const stepX = deltaX === 0 ? 0 : GRID_SIZE * Math.sign(deltaX)
      const stepY = deltaY === 0 ? 0 : GRID_SIZE * Math.sign(deltaY)

      for (let step = 1; step <= steps; step += 1) {
        const nextPos = {
          left: startPos.left + stepX * step,
          top: startPos.top + stepY * step,
        }
        if (checkCollisions(pieceId, nextPos, width, height)) {
          return false
        }
      }

      return true
    },
    [checkCollisions]
  )

  const handleDragStart = useCallback(
    (id: number, e: React.MouseEvent | React.TouchEvent) => {
      const pos = positions.get(id)
      if (!pos) return

      let clientX: number, clientY: number
      if ('touches' in e) {
        clientX = e.touches[0].clientX
        clientY = e.touches[0].clientY
      } else {
        clientX = e.clientX
        clientY = e.clientY
      }

      dragStartRef.current = {
        x: clientX,
        y: clientY,
        startPos: { ...pos },
      }

      setDraggingId(id)
      maxZIndexRef.current += 1
      setZIndices((prev) => {
        const newMap = new Map(prev)
        newMap.set(id, maxZIndexRef.current)
        return newMap
      })
    },
    [positions]
  )

  const handleDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (draggingId === null || !dragStartRef.current || !gameRef.current) return

      let clientX: number, clientY: number
      if ('touches' in e) {
        clientX = e.touches[0].clientX
        clientY = e.touches[0].clientY
        e.preventDefault()
      } else {
        clientX = e.clientX
        clientY = e.clientY
      }

      const deltaX = clientX - dragStartRef.current.x
      const deltaY = clientY - dragStartRef.current.y

      const piece = getPieceConfig(draggingId)
      const currentPos = positions.get(draggingId)!

      let newLeft = snapToGrid(dragStartRef.current.startPos.left + deltaX)
      let newTop = snapToGrid(dragStartRef.current.startPos.top + deltaY)

      if (newLeft !== dragStartRef.current.startPos.left && newTop !== dragStartRef.current.startPos.top) {
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
          newTop = dragStartRef.current.startPos.top
        } else {
          newLeft = dragStartRef.current.startPos.left
        }
      }

      const gameRect = gameRef.current.getBoundingClientRect()
      const gameWidth = gameRect.width - BORDER * 2
      const gameHeight = gameRect.height - BORDER * 2

      const maxGridIndexX = Math.floor((gameWidth - GRID_OFFSET - currentPos.width) / GRID_SIZE)
      const maxGridIndexY = Math.floor((gameHeight - GRID_OFFSET - currentPos.height) / GRID_SIZE)
      const maxLeft = GRID_OFFSET + Math.max(0, maxGridIndexX) * GRID_SIZE
      const maxTop = GRID_OFFSET + Math.max(0, maxGridIndexY) * GRID_SIZE

      newLeft = Math.max(GRID_OFFSET, Math.min(newLeft, maxLeft))
      newTop = Math.max(GRID_OFFSET, Math.min(newTop, maxTop))

      const hasCollision = checkCollisions(
        draggingId,
        { top: newTop, left: newLeft },
        currentPos.width,
        currentPos.height
      )

      const hasClearPath = isPathClear(
        dragStartRef.current.startPos,
        { top: newTop, left: newLeft },
        currentPos.width,
        currentPos.height,
        draggingId
      )

      if (!hasCollision && hasClearPath) {
        setPositions((prev) => {
          const newMap = new Map(prev)
          newMap.set(piece.id, {
            ...currentPos,
            top: newTop,
            left: newLeft,
          })
          return newMap
        })
      }
    },
    [draggingId, positions, getPieceConfig, snapToGrid, checkCollisions, isPathClear]
  )

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
    dragStartRef.current = null
  }, [])

  useEffect(() => {
    if (draggingId !== null) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      window.addEventListener('touchmove', handleDragMove, { passive: false })
      window.addEventListener('touchend', handleDragEnd)

      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
        window.removeEventListener('touchmove', handleDragMove)
        window.removeEventListener('touchend', handleDragEnd)
      }
    }
  }, [draggingId, handleDragMove, handleDragEnd])

  return (
    <>
      <h1>Help the panda get down</h1>
      <div id="game" ref={gameRef}>
        {initialPieces.map((piece) => (
          <Piece
            key={piece.id}
            config={piece}
            position={positions.get(piece.id)!}
            onDragStart={handleDragStart}
            zIndex={zIndices.get(piece.id) || 0}
          />
        ))}
      </div>
      <div className="solution-container">
        <button className="solution-button" disabled>
          🚫 Auto-solve is disabled
        </button>
      </div>
    </>
  )
}

export default App
