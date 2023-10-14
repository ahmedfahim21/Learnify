import React from 'react'
import {Link} from 'react-router-dom'
import '../../CSS/Secondarybtn.css'
function Secondarybtn({text,link}) {
  return (
    <div>
        <Link to={link} class="Sfull-rounded Sbutton">
<span>{text}</span>
<div class="Sborder Sfull-rounded"></div></Link>
    </div>
  )
}

export default Secondarybtn