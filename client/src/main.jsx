import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { TournamentsProvider } from './context/TournamentsContext'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TournamentsProvider>
      <App />
    </TournamentsProvider>
  </StrictMode>
)