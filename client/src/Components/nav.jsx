// import { Link } from 'react-router-dom'
import Primarybtn from './Buttons/Primarybtn'
import Secondarybtn from './Buttons/Secondarybtn'
import { Link } from 'react-router-dom'
import Arrowbtn from './Buttons/Arrowbtn'
function Nav() {
  return (
    <div className='flex justify-between p-5 w-3/4 mx-auto'>
        <Link to={'/'} className='text-3xl'>Learnify.ai</Link>
        <div className='flex gap-3'>
            
            <Arrowbtn text="Contact" link={"/contact"} />


        </div>
        
    </div>
  )
}

export default Nav