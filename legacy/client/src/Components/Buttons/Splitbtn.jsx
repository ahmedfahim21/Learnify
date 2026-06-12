import React from 'react'
import { Link } from 'react-router-dom'
import '../../CSS/Splitbtn.css'
function Splitbtn({text, link}) {
    return (
        <div>
            <Link to={link} className="btn-17">
                <span className="text-container">
                    <span className="text">{text}</span>
                </span>
            </Link>

        </div>
    )
}

export default Splitbtn