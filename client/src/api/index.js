// The only file the app imports API functions from.
//
// Which backend is used is one environment variable, set at BUILD time:
//
//   VITE_USE_MOCK_API=false  -> the Express API at VITE_API_BASE_URL
//   anything else, INCLUDING UNSET -> the browser-only demo (localStorage)
//
// Demo mode is the default, so a build with no configuration still works
// and shows a demo notice rather than calling an empty URL.
//
// Both modules are imported statically and one is chosen at run time:
// top-level await (for a dynamic import) doesn't build in Vite's default
// browser target.

import * as mockApi from './mockApi.js'
import * as httpApi from './httpApi.js'

export const USING_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false'

const implementation = USING_MOCK_API ? mockApi : httpApi

export const {
  login,
  listTournaments,
  createTournament,
  replaceTournament,
  updateTournament,
  deleteTournament,
  listPlayers,
  renamePlayer,
  deletePlayer,
  subscribe,
} = implementation

export const ADMIN_TOKEN_KEY = 'adminToken'
