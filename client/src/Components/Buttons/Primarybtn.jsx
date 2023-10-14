import React from 'react'
import { Link } from 'react-router-dom'

function Primarybtn({link, text}) {
    return (
        <div className='mx-2'>
            <Link to={link} class="p-2  bg-white cursor-pointer rounded-xl border-2 border-[#9748FF] shadow-[inset_0px_-2px_0px_1px_#9748FF] group hover:bg-[#9748FF] transition duration-300 ease-in-out">
                <span class="font-medium text-[#333] group-hover:text-white">{text}</span>
            </Link>
        </div>
    )
}

export default Primarybtn