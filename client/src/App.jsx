
import './App.css'

import Nav from './Components/nav'
import Footer from './Components/footer'
import Hero from './Components/Hero'

import Contact from './Components/Contact'

 
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'

function App() {
 

  return (
    <div>
      <Router>
      <main>
        <Nav/>
        
        <div className='app'>
        <Routes>
          <Route path='/' element={<Hero />} />
          {/* <Route path='/about' element={<About />} /> */}
          <Route path='/contact' element={<Contact />} />
        </Routes>
        </div>

        <Footer />

        </main>
      </Router>
    </div>
  )
}

export default App
