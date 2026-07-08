'use client'

import { useState, useEffect } from 'react'
import { Delete } from 'lucide-react'

interface PinPadProps {
  length?: number
  onComplete: (pin: string) => void
  error?: boolean
  disabled?: boolean
}

export function PinPad({ length = 4, onComplete, error, disabled }: PinPadProps) {
  const [pin, setPin] = useState('')

  useEffect(() => {
    if (pin.length === length) {
      onComplete(pin)
      const timeout = setTimeout(() => setPin(''), 400)
      return () => clearTimeout(timeout)
    }
  }, [pin, length, onComplete])

  useEffect(() => {
    if (error) {
      setPin('')
    }
  }, [error])

  const handleDigit = (digit: string) => {
    if (disabled || pin.length >= length) return
    setPin((prev) => prev + digit)
  }

  const handleDelete = () => {
    if (disabled) return
    setPin((prev) => prev.slice(0, -1))
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-xs">

      <div className="flex gap-3">
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className="w-3.5 h-3.5 rounded-full transition-all duration-150"
            style={{
              backgroundColor: i < pin.length
                ? (error ? '#ef4444' : '#c9a84c')
                : 'transparent',
              border: `1.5px solid ${error ? '#ef4444' : i < pin.length ? '#c9a84c' : '#d1d5db'}`,
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 w-full">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />

          if (d === 'delete') {
            return (
              <button
                key={i}
                onClick={handleDelete}
                disabled={disabled || pin.length === 0}
                className="h-16 rounded-2xl flex items-center justify-center transition-colors hover:bg-gray-100 disabled:opacity-30"
              >
                <Delete size={20} className="text-gray-500" />
              </button>
            )
          }

          return (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              disabled={disabled}
              className="h-16 rounded-2xl flex items-center justify-center text-xl font-semibold border transition-colors hover:bg-gray-50 disabled:opacity-30"
              style={{ borderColor: '#e5e7eb' }}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}