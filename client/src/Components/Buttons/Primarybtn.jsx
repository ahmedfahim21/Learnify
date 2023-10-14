import React from 'react'
import { Link } from 'react-router-dom'
function Primarybtn({link, text}) {
    return (
        <div>
            <Link to={link} class="w-40 h-12 bg-white cursor-pointer rounded-3xl border-2 border-[#9748FF] shadow-[inset_0px_-2px_0px_1px_#9748FF] group hover:bg-[#9748FF] transition duration-300 ease-in-out">
                <span class="font-medium text-[#333] group-hover:text-white">{text}</span>
            </Link>
        </div>
    )
}

export default Primarybtn