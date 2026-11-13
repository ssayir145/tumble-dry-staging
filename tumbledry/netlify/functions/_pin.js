// netlify/functions/_pin.js — PIN hashing shared by rider accounts

import crypto from 'crypto'

export function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(String(pin), salt, 32).toString('hex')}`
}

export function pinMatches(pin, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(String(pin), salt, 32)
  const real = Buffer.from(hash, 'hex')
  return test.length === real.length && crypto.timingSafeEqual(test, real)
}

export const validPin = pin => /^\d{4,6}$/.test(String(pin || ''))
