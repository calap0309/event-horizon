import { useEffect, useRef } from 'react'
import { FRAG, VERT } from '../shaders/blackhole'

export type HorizonParams = {
  mass: number
  disk: number
  spin: number
  bloom: number
  quality: number
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)
  if (!sh) throw new Error('shader create failed')
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? 'unknown'
    gl.deleteShader(sh)
    throw new Error(log)
  }
  return sh
}

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader) {
  const prog = gl.createProgram()
  if (!prog) throw new Error('program create failed')
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? 'unknown'
    gl.deleteProgram(prog)
    throw new Error(log)
  }
  return prog
}

export function useBlackHole(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  paramsRef: React.RefObject<HorizonParams>,
  active: boolean,
) {
  const mouseRef = useRef({ x: 0.35, y: 0.15, dragging: false, lx: 0, ly: 0 })
  const errorRef = useRef<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) return

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    })
    if (!gl) {
      errorRef.current = 'WebGL2 unavailable'
      return
    }

    let prog: WebGLProgram
    try {
      const vs = compile(gl, gl.VERTEX_SHADER, VERT)
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
      prog = link(gl, vs, fs)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    } catch (e) {
      errorRef.current = e instanceof Error ? e.message : 'Shader error'
      return
    }

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )

    const loc = gl.getAttribLocation(prog, 'aPos')
    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uTime = gl.getUniformLocation(prog, 'uTime')
    const uMouse = gl.getUniformLocation(prog, 'uMouse')
    const uMass = gl.getUniformLocation(prog, 'uMass')
    const uDisk = gl.getUniformLocation(prog, 'uDisk')
    const uSpin = gl.getUniformLocation(prog, 'uSpin')
    const uBloom = gl.getUniformLocation(prog, 'uBloom')
    const uQuality = gl.getUniformLocation(prog, 'uQuality')

    gl.useProgram(prog)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    let raf = 0
    let start = performance.now()
    let w = 0
    let h = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = Math.floor(canvas.clientWidth * dpr)
      h = Math.floor(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      mouseRef.current.dragging = true
      mouseRef.current.lx = e.clientX
      mouseRef.current.ly = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const onPointerUp = () => {
      mouseRef.current.dragging = false
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!mouseRef.current.dragging) return
      const dx = (e.clientX - mouseRef.current.lx) / window.innerWidth
      const dy = (e.clientY - mouseRef.current.ly) / window.innerHeight
      mouseRef.current.lx = e.clientX
      mouseRef.current.ly = e.clientY
      mouseRef.current.x += dx * 2.2
      mouseRef.current.y = Math.max(-0.95, Math.min(0.95, mouseRef.current.y - dy * 2.2))
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointermove', onPointerMove)
    window.addEventListener('resize', resize)
    resize()

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      resize()
      const p = paramsRef.current
      const m = mouseRef.current
      // idle drift when not dragging
      if (!m.dragging) {
        m.x += 0.00035
      }
      gl.uniform2f(uRes, w, h)
      gl.uniform1f(uTime, (now - start) * 0.001)
      gl.uniform2f(uMouse, m.x, m.y)
      gl.uniform1f(uMass, p?.mass ?? 1.2)
      gl.uniform1f(uDisk, p?.disk ?? 1.0)
      gl.uniform1f(uSpin, p?.spin ?? 0.7)
      gl.uniform1f(uBloom, p?.bloom ?? 0.85)
      gl.uniform1f(uQuality, p?.quality ?? 0.75)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', resize)
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
    }
  }, [active, canvasRef, paramsRef])

  return errorRef
}
