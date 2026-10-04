// Create an admin account, or change an existing admin's password.
//
//   cd server
//   npm run admin:create -- <username>
//
// It asks for the password without showing it on screen, so the password
// never ends up in your shell history or in a file. Only the scrypt hash is
// stored in the admins table.

import './owner.js' // creating an admin needs the owner login; see owner.js
import readline from 'node:readline'
import { pool } from './pool.js'
import { hashPassword } from '../auth.js'
import * as admins from '../adminsRepo.js'

const username = process.argv[2]
if (!username || !/^[A-Za-z0-9_.-]{3,50}$/.test(username)) {
  console.error('usage: npm run admin:create -- <username>   (3-50 letters, numbers, _ . -)')
  process.exit(1)
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    let muted = false
    rl._writeToOutput = (text) => {
      if (!muted) rl.output.write(text)
    }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
    muted = true
  })
}

try {
  const password = await askHidden(`Password for ${username}: `)
  if (password.length < 8) throw new Error('Use at least 8 characters.')
  const again = await askHidden('Type it again: ')
  if (password !== again) throw new Error("The passwords don't match.")

  await admins.save(pool, { username, password_hash: await hashPassword(password) })
  console.log(`Saved admin "${username}". You can log in on the Admin Login page now.`)
} catch (error) {
  console.error(`Could not save the admin: ${error.message}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
