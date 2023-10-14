import React from "react";
// import Social from ".
// import Weather from "./Weather";
import { Link } from "react-router-dom";
// import resume_pdf from "../assets/ChiragRajput_NE.pdf"
// import logo from "../assets/logo.webp"
function Footer() {
  
  return (
    <div className=" flex flex-col">
      <div className="footer-break mt-12 border-primary border-opacity-50 w-2/3 mx-auto sm:hidden"></div>
      <div className="flex sm:flex-row xl:w-3/4 w-full mx-auto flex-col items-center sm:items-start  justify-between pt-12 pb-12 px-12">
        <div className="flex flex-col justify-center items-center sm:items-start gap-2">
          <h2 className="font-semibold text-primary text-xl ">General</h2>
          <div className="flex flex-col gap-3 text-md  items-center sm:items-start">
            <Link to="/Contact" className="hover:text-violet-600 ">
              Contact Us
            </Link>

            <Link to="/Faq" className="hover:text-violet-600">FAQs</Link>
          
            {/* <Link to ="" href=""className="hover:text-yellow-500"></Link> */}
            
            <p className="mt-1 sm:text-left text-center hidden sm:block">
              {" "}
              Based in <br />
              Bangalore, Karnataka, India
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-12 sm:mt-0">
          <h2 className="font-semibold text-primary text-xl ">Important Links</h2>
          <div className="flex flex-col sm:items-start items-center gap-3 text-md">
            
            <a href="https://github.com/Chirag2203" target="_blank" className="hover:text-violet-600">Github</a>
            <a href="https://www.linkedin.com/in/cr2203/"target="_blank" className="hover:text-violet-600">LinkedIn</a>
            
            <a href="https://www.instagram.com/chirag_2203/"target="_blank" className="hover:text-violet-600">Instagram</a>
            
          </div>
        </div>
        <div className="flex flex-col gap-5 mt-12 sm:mt-0">
          <h2 className="font-semibold text-primary  text-xl ">Others</h2>
          <div className="flex flex-col gap-3 text-md  sm:items-start items-center">
            <a href="#"className=" hover:text-violet-600">Privacy Policy</a>
            <a href="#"className=" hover:text-violet-600">Terms and conditions</a>
            <a href="#"className=" hover:text-violet-600">Join us!</a>
            
          </div>
        </div>
        <div className="sm:w-1/4 flex flex-col  justify-between text-center items-center mt-12 sm:mt-0 ">
          <div className="flex-col flex items-center gap-5">
          
          <span className="md:text-2xl text-md text-secondary w-full">Learnify.ai</span>
          </div>
          
          {/* <form class="subscribe-form mt-5">
            <input
              type="email"
              placeholder="example@mail.com"
              class="subscribe-input"
            />
            <button class="subscribe-btn">Subscribe</button>
          </form> */}

        </div>
      </div>
      {/* heart emoji */}
      <div className="flex justify-center items-center">
        <p className="text-center text-violet-900  p-2" >V 1.0 🚀</p>
      </div>
     
    </div>
  );
}

export default Footer;