import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

import nav from './Components/nav'
import footer from './Components/footer'
import Hero from './Components/Hero'
// import About from './Components/About'
import Contact from './Components/Contact'
import Home from './Home'
 
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'

function App() {
 

  return (
    <div>
      <Router>
      <main>
        {/* <div className='main'>
          <div className='gradient' />
        </div> */}
        <nav />
        
        <div className='app'>
        <Routes>
          <Route path='/' element={<Hero />} />
          {/* <Route path='/about' element={<About />} /> */}
          <Route path='/contact' element={<Contact />} />
        </Routes>
        </div>

        <footer />

        </main>
      </Router>
    </div>
  )
}

export default App
