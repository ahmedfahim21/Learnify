// import { Link } from 'react-router-dom'
import Primarybtn from './Buttons/Primarybtn'
import Secondarybtn from './Buttons/Secondarybtn'
function Nav() {
  return (
    <div className='flex justify-between p-5 w-3/4 mx-auto'>
        <span className='text-3xl'>Learnify.ai</span>
        <div className='flex gap-3'>
            <Primarybtn text="Home" link={"/"} />
            <Primarybtn text="About" link={"/about"} />
            <Primarybtn text="Contact" link={"/contact"} />


        </div>
        
    </div>
  )
}

export default Nav