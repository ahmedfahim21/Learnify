import React from 'react';
import "../../CSS/Arrowbtn.css";
import { Link } from 'react-router-dom';

function Arrowbtn({ link, text }) {
  return (
    <Link to={link}>
      <a style={{ "--clr": "#7808d0" }} className="Abutton" href="#">
        <span className="button__icon-wrapper">
          <svg width="10" className="button__icon-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 15">
            <path fill="currentColor" d="M13.376 11.552l-.264-10.44-10.44-.24.024 2.28 6.96-.048L.2 12.56l1.488 1.488 9.432-9.432-.048 6.912 2.304.024z"></path>
          </svg>

          <svg className="button__icon-svg  button__icon-svg--copy" xmlns="http://www.w3.org/2000/svg" width="10" fill="none" viewBox="0 0 14 15">
            <path fill="currentColor" d="M13.376 11.552l-.264-10.44-10.44-.24.024 2.28 6.96-.048L.2 12.56l1.488 1.488 9.432-9.432-.048 6.912 2.304.024z"></path>
          </svg>
        </span>
        {text}
      </a>
    </Link>
  );
}

export default Arrowbtn;
