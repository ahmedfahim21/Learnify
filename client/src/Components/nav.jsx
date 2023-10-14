import React from 'react'
import { Link } from 'react-router-dom'
import Primarybtn from './Buttons/Primarybtn'
function nav() {
  return (
    <div className='flex justify-between'>
        <span>LOGO</span>
        <div className='flex gap-3'>
            <Primarybtn text="Home" link={"/"} />
            <Primarybtn text="About" link={"/about"} />
            <Primarybtn text="Contact" link={"/contact"} />


        </div>
        
    </div>
  )
}

export default nav