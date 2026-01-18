import { useState, useCallback, useRef, useEffect } from 'react'
import './App.css'

interface Move {
  pieceId: number
  toRow: number
  toCol: number
}

interface GameState {
  positions: Map<number, { row: number; col: number }>
}

interface QueueItem {
  state: GameState
  moves: Move[]
}

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

// Solver functions
function serializeState(state: GameState): string {
  const positions = Array.from(state.positions.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([id, pos]) => `${id}:${pos.row},${pos.col}`)
    .join('|')
  return positions
}

function getPieceSize(pieceId: number): { rows: number; cols: number } {
  const piece = initialPieces.find((p) => p.id === pieceId)!
  switch (piece.type) {
    case H:
      return { rows: 1, cols: 2 }
    case V:
      return { rows: 2, cols: 1 }
    case HV:
      return { rows: 2, cols: 2 }
    default:
      return { rows: 1, cols: 1 }
  }
}

function checkGridCollision(
  pieceId: number,
  row: number,
  col: number,
  state: GameState
): boolean {
  const size = getPieceSize(pieceId)

  // Check bounds (5 rows x 4 cols grid)
  if (row < 1 || col < 1 || row + size.rows - 1 > 5 || col + size.cols - 1 > 4) {
    return true
  }

  // Check collision with other pieces
  for (const [otherId, otherPos] of state.positions) {
    if (otherId === pieceId) continue

    const otherSize = getPieceSize(otherId)

    // Check if rectangles overlap
    const thisRight = col + size.cols - 1
    const thisBottom = row + size.rows - 1
    const otherRight = otherPos.col + otherSize.cols - 1
    const otherBottom = otherPos.row + otherSize.rows - 1

    const overlaps = !(
      col > otherRight ||
      thisRight < otherPos.col ||
      row > otherBottom ||
      thisBottom < otherPos.row
    )

    if (overlaps) return true
  }

  return false
}

function getPossibleMoves(state: GameState): Move[] {
  const moves: Move[] = []

  for (const [pieceId, pos] of state.positions) {
    // Try moving in all 4 directions
    const directions = [
      { row: pos.row - 1, col: pos.col }, // up
      { row: pos.row + 1, col: pos.col }, // down
      { row: pos.row, col: pos.col - 1 }, // left
      { row: pos.row, col: pos.col + 1 }, // right
    ]

    for (const newPos of directions) {
      if (!checkGridCollision(pieceId, newPos.row, newPos.col, state)) {
        moves.push({
          pieceId,
          toRow: newPos.row,
          toCol: newPos.col,
        })
      }
    }
  }

  return moves
}

function calculateHeuristic(state: GameState): number {
  const pandaPos = state.positions.get(2)!
  const targetRow = 4
  const targetCol = 2

  // Manhattan distance from panda to target
  return Math.abs(pandaPos.row - targetRow) + Math.abs(pandaPos.col - targetCol)
}

interface PriorityQueueItem extends QueueItem {
  priority: number
}

function solvePuzzle(): Move[] | null {
  const initialState: GameState = {
    positions: new Map(
      initialPieces.map((p) => [p.id, { row: p.row, col: p.col }])
    ),
  }

  const queue: PriorityQueueItem[] = [{
    state: initialState,
    moves: [],
    priority: calculateHeuristic(initialState)
  }]
  const visited = new Set<string>()
  visited.add(serializeState(initialState))

  let statesExplored = 0
  const maxStates = 500000 // Limit to prevent infinite loops

  while (queue.length > 0 && statesExplored < maxStates) {
    // Sort queue by priority (A* search)
    queue.sort((a, b) => a.priority - b.priority)
    const current = queue.shift()!
    statesExplored++

    const pandaPos = current.state.positions.get(2)!

    // Check if panda reached target position (row 4, col 2)
    if (pandaPos.row === 4 && pandaPos.col === 2) {
      console.log(`✅ Solution found in ${current.moves.length} moves!`)
      console.log(`States explored: ${statesExplored}`)
      return current.moves
    }

    // Log progress every 10000 states
    if (statesExplored % 10000 === 0) {
      console.log(`Progress: ${statesExplored} states, queue: ${queue.length}`)
    }

    // Generate all possible moves
    const possibleMoves = getPossibleMoves(current.state)

    for (const move of possibleMoves) {
      const newState: GameState = {
        positions: new Map(current.state.positions),
      }
      newState.positions.set(move.pieceId, {
        row: move.toRow,
        col: move.toCol,
      })

      const stateKey = serializeState(newState)
      if (!visited.has(stateKey)) {
        visited.add(stateKey)
        const newMoves = [...current.moves, move]
        const heuristic = calculateHeuristic(newState)
        const priority = newMoves.length + heuristic // f(n) = g(n) + h(n)

        queue.push({
          state: newState,
          moves: newMoves,
          priority,
        })
      }
    }
  }

  console.log(`❌ No solution found after exploring ${statesExplored} states`)
  return null
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

  const [isAnimating, setIsAnimating] = useState(false)
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0)
  const animationIntervalRef = useRef<number | null>(null)

  const [solution, setSolution] = useState<Move[] | null>(null)
  const [solutionStatus, setSolutionStatus] = useState<'idle' | 'solving' | 'solved' | 'error'>('idle')

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

  const resetToInitialState = useCallback(() => {
    const newPositions = new Map<number, PiecePosition>()
    initialPieces.forEach((piece) => {
      newPositions.set(piece.id, calculatePosition(piece.row, piece.col, piece.type))
    })
    setPositions(newPositions)
    setCurrentMoveIndex(0)
  }, [])

  const stopAnimation = useCallback(() => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current)
      animationIntervalRef.current = null
    }
    setIsAnimating(false)
  }, [])

  const executeMove = useCallback((move: Move) => {
    const piece = getPieceConfig(move.pieceId)
    const newPosition = calculatePosition(move.toRow, move.toCol, piece.type)

    setPositions((prev) => {
      const newMap = new Map(prev)
      newMap.set(move.pieceId, newPosition)
      return newMap
    })
  }, [getPieceConfig])

  const startAutoSolve = useCallback(() => {
    if (isAnimating || !solution) return

    const confirmed = window.confirm(
      'This will reset the puzzle and show the animated solution. Continue?'
    )

    if (!confirmed) return

    resetToInitialState()
    setIsAnimating(true)

    let moveIndex = 0

    animationIntervalRef.current = setInterval(() => {
      if (moveIndex >= solution.length) {
        stopAnimation()
        return
      }

      const move = solution[moveIndex]
      executeMove(move)
      setCurrentMoveIndex(moveIndex + 1)
      moveIndex++
    }, 500) // 500ms between moves
  }, [isAnimating, solution, resetToInitialState, stopAnimation, executeMove])

  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current)
      }
    }
  }, [])

  // Compute solution on mount
  useEffect(() => {
    setSolutionStatus('solving')
    console.log('Computing optimal solution...')
    const startTime = Date.now()

    // Run solver in a timeout to not block rendering
    setTimeout(() => {
      try {
        const moves = solvePuzzle()
        const endTime = Date.now()

        if (moves) {
          setSolution(moves)
          setSolutionStatus('solved')
          console.log(`Solution computed in ${endTime - startTime}ms`)
        } else {
          setSolutionStatus('error')
          console.error('Failed to find solution')
        }
      } catch (error) {
        setSolutionStatus('error')
        console.error('Error computing solution:', error)
      }
    }, 100)
  }, [])

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
        {solutionStatus === 'solving' && (
          <button className="solution-button" disabled>
            ⏳ Computing solution...
          </button>
        )}
        {solutionStatus === 'error' && (
          <button className="solution-button" disabled>
            ❌ Failed to compute solution
          </button>
        )}
        {solutionStatus === 'solved' && !isAnimating && (
          <button
            className="solution-button"
            onClick={startAutoSolve}
          >
            🎬 Auto-Solve Puzzle ({solution?.length} moves)
          </button>
        )}
        {isAnimating && (
          <div className="animation-controls">
            <button
              className="solution-button stop-button"
              onClick={stopAnimation}
            >
              ⏹️ Stop Animation
            </button>
            <p className="animation-status">
              Move {currentMoveIndex} / {solution?.length || 0}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

export default App
