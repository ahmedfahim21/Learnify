import Splitbtn from "./Buttons/Splitbtn"
import {motion} from "framer-motion"

import { fadeInAnimation } from "./animation"

function Hero() {
  return (
    <motion.div {...fadeInAnimation}  className="w-3/4 mx-auto flex flex-col items-center pt-32 min-h-screen  h-auto">
      
      <span className=" text-3xl md:text-6xl animated-text ">We make your Learning <span className="orange-500"></span> </span>
            <span className=" text-xl sm:text-4xl text-bold text-center">
              
            </span>
      <div className="mt-8">
      <span className="text-2xl mt-8 sm:w-1/2 w-full p-2 mx-auto text-center ">Learnify is a platform that provides you with the best learning experience with the help of AI.</span>
      <div className="flex items-center justify-center mt-12">
      <Splitbtn text="Get Started " link={"/courses"} />
      </div>
      </div>
     
    </motion.div>
  )
}

export default Hero