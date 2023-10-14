import Splitbtn from "./Buttons/Splitbtn"

function Hero() {
  return (
    <div className="w-3/4 mx-auto flex flex-col items-center pt-32 min-h-screen h-auto">
      <span className="text-5xl font-bold ">We make your Learning fun and simple</span>
      <span className="text-2xl mt-8 w-1/2 mx-auto text-center ">Learnify is a platform that provides you with the best learning experience.</span>
      <div className="mt-8">
      <Splitbtn text="Get Started " link={"/Courses"} />
      </div>
     
    </div>
  )
}

export default Hero