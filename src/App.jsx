import React from 'react'
import SignalsetEditor from './components/SignalsetEditor'

function App() {
  return (
    <div className="container mx-auto py-8 px-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">OBDb Signal Set Editor</h1>
        <p className="text-gray-600">
          Edit and validate OBDb signal set specifications for vehicle parameter definitions.
        </p>
      </header>
      <SignalsetEditor />
    </div>
  )
}

export default App