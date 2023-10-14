import React from 'react'
import { Link } from 'react-router-dom'
import '../../CSS/Splitbtn.css'
function Splitbtn({text, link}) {
    return (
        <div>
            <Link to={link} class="btn-17">
                <span class="text-container">
                    <span class="text">{text}</span>
                </span>
            </Link>

        </div>
    )
}

export default Splitbtn