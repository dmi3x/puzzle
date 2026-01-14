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

  return !(bLeft > aRight || bRight < aLeft || bTop > aBottom || bBottom < aTop)
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
  const [showSolution, setShowSolution] = useState(false)
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

      if (!hasCollision) {
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
    [draggingId, positions, getPieceConfig, snapToGrid, checkCollisions]
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
        <button
          className="solution-button"
          onClick={() => setShowSolution(!showSolution)}
        >
          {showSolution ? 'Hide Solution' : 'Reveal Solution'}
        </button>
        {showSolution && (
          <p className="solution-text">
            Move small pieces to corners. Slide vertical pieces aside. 
            Move the horizontal piece up. Guide the panda down through the center gap.
          </p>
        )}
      </div>
    </>
  )
}

export default App
